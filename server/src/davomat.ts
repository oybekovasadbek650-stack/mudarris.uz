// Davomat tizimi (Xodim Plus API, keldi-ketdi/davomat/api_server.py) bilan integratsiya — FAQAT O'QISH.
// Davomatda nomlar boshqacha: "branch" = yo'nalish (maktab / kids / akademiya), "department" = filial.
// Bizda: Branch = filial (davomatdagi department), Branch.org = yo'nalish.
import { crc32 } from 'node:zlib'
import { config } from './config.ts'
import { HttpError, fail } from './repo.ts'
import type { Org } from '../../src/types.ts'

export interface DavomatDepartment {
  id: number
  name: string
  branchId: number
  employeeCount: number
}
export interface DavomatGroup {
  id: number
  name: string
}
export interface DavomatEmployee {
  id: number
  employeeCode: string
  fullName: string
  department: { id: number; name: string }
  branch: { id: number; name: string }
  status: string
}

export const davomatEnabled = () => Boolean(config.davomatUrl && config.davomatLogin && config.davomatPassword)

let token = ''

async function login() {
  const r = await fetch(`${config.davomatUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: config.davomatLogin, password: config.davomatPassword }),
    signal: AbortSignal.timeout(10_000),
  })
  if (r.status === 401) fail(502, "Davomat tizimiga kirib bo'lmadi: login yoki parol noto'g'ri (DAVOMAT_LOGIN/DAVOMAT_PASSWORD)")
  if (!r.ok) fail(502, `Davomat tizimi javob bermadi (${r.status})`)
  token = ((await r.json()) as { accessToken: string }).accessToken
}

async function get<T>(path: string, retry = true): Promise<T> {
  if (!davomatEnabled()) fail(503, "Davomat integratsiyasi sozlanmagan (server .env: DAVOMAT_URL, DAVOMAT_LOGIN, DAVOMAT_PASSWORD)")
  try {
    if (!token) await login()
    const r = await fetch(`${config.davomatUrl}/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (r.status === 401 && retry) {
      token = ''
      return get<T>(path, false)
    }
    if (!r.ok) fail(502, `Davomat tizimi xato qaytardi (${r.status})`)
    return (await r.json()) as T
  } catch (e) {
    if (e instanceof HttpError) throw e
    // Tarmoq xatosi yoki vaqt tugadi (fetch TypeError / TimeoutError)
    return fail(502, `Davomat tizimiga ulanib bo'lmadi (${config.davomatUrl}). Server yoqilganini va tarmoqni tekshiring.`)
  }
}

export const davomatDepartments = () => get<DavomatDepartment[]>('/org/departments')
export const davomatGroups = () => get<DavomatGroup[]>('/org/branches')

/** Hamma xodimlar (sahifalab, 200 tadan) */
export async function davomatEmployees(): Promise<DavomatEmployee[]> {
  const all: DavomatEmployee[] = []
  for (let page = 1; page < 100; page++) {
    const r = await get<{ items: DavomatEmployee[]; meta: { total: number } }>(`/employees?pageSize=200&page=${page}`)
    all.push(...r.items)
    if (all.length >= r.meta.total || r.items.length === 0) break
  }
  return all
}

/**
 * Davomatdagi raqamli xodim ID (api_server.py: xodim_raqami): kod raqam bo'lsa — o'zi, aks holda crc32.
 * Davomat yozuvlarida (attendance/records) xodim shu raqam bilan keladi.
 */
export function davomatEmployeeId(code: string): string {
  if (/^\d+$/.test(code) && code.length < 16) return String(Number(code))
  return String(crc32(Buffer.from(code, 'utf8')) & 0x7fffffff)
}

/** Shu kuni davomatda KIRISHI bor xodimlar (raqamli ID'lar). Bugun kelmaganlar uchun davomat yozuv qaytarmaydi. */
export async function davomatCheckedIn(date: string): Promise<Set<string>> {
  const ids = new Set<string>()
  for (let page = 1; page < 100; page++) {
    const r = await get<{ items: { employee: { id: number }; checkIn: string | null }[]; meta: { total: number } }>(
      `/attendance/records?from=${date}&to=${date}&pageSize=200&page=${page}`,
    )
    for (const it of r.items) if (it.checkIn) ids.add(String(it.employee.id))
    if (page * 200 >= r.meta.total || r.items.length === 0) break
  }
  return ids
}

export interface DavomatMonthlyRow {
  employee: { id: number }
  workingDays: number
  presentDays: number
  lateDays: number
  absentDays: number
  lateMinutes: number
  workedMinutes: number
}

/** Davomat oylik hisoboti (oy boshidan bugungacha; bugun "kelmagan" sanalmaydi) */
export const davomatMonthly = (month: string) => get<{ rows: DavomatMonthlyRow[] }>(`/reports/monthly?month=${month}`)

/** Oraliqdagi "absent" (ish kuni, kirish yo'q) sanalar: xodim raqamli ID -> sanalar */
export async function davomatAbsentDates(from: string, to: string): Promise<Map<string, string[]>> {
  const res = new Map<string, string[]>()
  for (let page = 1; page < 500; page++) {
    const r = await get<{ items: { employee: { id: number }; date: string; status: string }[]; meta: { total: number } }>(
      `/attendance/records?from=${from}&to=${to}&status=absent&pageSize=200&page=${page}`,
    )
    for (const it of r.items) {
      const k = String(it.employee.id)
      res.set(k, [...(res.get(k) ?? []), it.date])
    }
    if (page * 200 >= r.meta.total || r.items.length === 0) break
  }
  return res
}

/** Yo'nalish nomidan tashkilot turi: "Mudarris Maktabi" -> school, "Mudarris Kids" -> kindergarten ... */
export function orgFromGroupName(name: string): Org | undefined {
  const n = name.toLowerCase()
  if (/akadem/.test(n)) return 'academy'
  if (/kids|bog.?cha|bog'cha|bogcha/.test(n)) return 'kindergarten'
  if (/maktab|school/.test(n)) return 'school'
  return undefined
}

/** "Aʼzamov Abdulhamid" va "Abdulhamid A'zamov" bir xil odam: so'zlar tartibi va apostroflarsiz solishtiramiz */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ʻʼ'‘’`´]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

/** Davomat kodi 9 xonali telefon raqam bo'lsa — "+998 91 838 12 21" ko'rinishida */
export function phoneFromCode(code: string): string {
  const d = code.replace(/\D/g, '')
  if (d.length !== 9) return ''
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
}
