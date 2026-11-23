// Davomatdan filiallar va xodimlarni olish (bir tomonlama: davomat -> o'rinbosar).
// Davomatga hech narsa yozilmaydi. Bizdagi filial/o'qituvchi o'chirilmaydi.
import { randomInt } from 'node:crypto'
import { db, newId, tx } from './db.ts'
import { config } from './config.ts'
import { hashPassword } from './auth.ts'
import { fail, loginTaken, type TeacherRow } from './repo.ts'
import { davomatDepartments, davomatEmployees, davomatGroups, nameKey, orgFromGroupName, phoneFromCode } from './davomat.ts'
import { localNow } from './time.ts'
import type { DavomatEmployeeView, DavomatImportResult, DavomatSyncResult, Org } from '../../src/types.ts'

const normName = (s: string) => s.toLowerCase().replace(/[ʻʼ'‘’`´]/g, "'").replace(/\s+/g, ' ').trim()

/** Davomatdagi 15 ta filialni bizga qo'shadi/yangilaydi (davomat_id bo'yicha, bo'lmasa nom bo'yicha) */
export async function syncBranches(): Promise<DavomatSyncResult> {
  const [deps, groups] = await Promise.all([davomatDepartments(), davomatGroups()])
  const orgOfGroup = new Map(groups.map((g) => [g.id, orgFromGroupName(g.name)]))
  const ours = db().prepare('SELECT id, name, org, davomat_id FROM branches').all() as {
    id: string
    name: string
    org: Org
    davomat_id: number | null
  }[]
  const created: string[] = []
  const updated: string[] = []

  tx(() => {
    for (const d of deps) {
      const org = orgOfGroup.get(d.branchId)
      if (!org) continue // yo'nalish turi aniqlanmadi — o'tkazib yuboramiz
      const byId = ours.find((b) => b.davomat_id === d.id)
      const byName = ours.find((b) => b.davomat_id == null && normName(b.name) === normName(d.name))
      const target = byId ?? byName
      if (target) {
        if (target.name !== d.name || target.org !== org || target.davomat_id !== d.id) {
          // Nom boshqa (bog'lanmagan) filialda band bo'lsa — nomni o'zgartirmaymiz
          const clash = db().prepare('SELECT 1 FROM branches WHERE name = ? AND id != ?').get(d.name, target.id)
          db()
            .prepare('UPDATE branches SET name = ?, org = ?, davomat_id = ? WHERE id = ?')
            .run(clash ? target.name : d.name, org, d.id, target.id)
          updated.push(d.name)
        }
      } else {
        const clash = db().prepare('SELECT 1 FROM branches WHERE name = ?').get(d.name)
        db()
          .prepare('INSERT INTO branches (id, name, org, davomat_id) VALUES (?, ?, ?, ?)')
          .run(newId('b'), clash ? `${d.name} (davomat)` : d.name, org, d.id)
        created.push(d.name)
      }
    }
  })

  const notInDavomat = (db().prepare('SELECT name FROM branches WHERE davomat_id IS NULL ORDER BY name').all() as { name: string }[]).map((b) => b.name)
  return { created, updated, total: deps.length, notInDavomat }
}

/** Davomatdagi xodimlar va ularning bizdagi holati. scopeBranchId — direktor uchun faqat o'z filiali */
export async function listEmployees(scopeBranchId?: string): Promise<DavomatEmployeeView[]> {
  const employees = await davomatEmployees()
  const branches = db().prepare('SELECT id, davomat_id FROM branches WHERE davomat_id IS NOT NULL').all() as { id: string; davomat_id: number }[]
  const branchOfDep = new Map(branches.map((b) => [b.davomat_id, b.id]))
  const teachers = db().prepare("SELECT * FROM teachers WHERE status != 'rejected'").all() as unknown as TeacherRow[]

  return employees
    .map((e): DavomatEmployeeView => {
      const branchId = branchOfDep.get(e.department.id) ?? null
      const base = { code: e.employeeCode, fullName: e.fullName, departmentName: e.department.name, branchId }
      const linked = teachers.find((t) => t.davomat_code === e.employeeCode)
      if (linked) return { ...base, status: 'linked', teacherId: linked.id, teacherName: linked.full_name }
      if (!branchId) return { ...base, status: 'no_branch' }
      const match = teachers.find((t) => !t.davomat_code && t.branch_id === branchId && nameKey(t.full_name) === nameKey(e.fullName))
      if (match) return { ...base, status: 'match', teacherId: match.id, teacherName: match.full_name }
      return { ...base, status: 'new' }
    })
    .filter((v) => !scopeBranchId || v.branchId === scopeBranchId)
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName) || a.fullName.localeCompare(b.fullName))
}

/** O'qish oson, adashtirmaydigan harflar (0/O, 1/l yo'q) */
function randomPassword(len = 8) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => abc[randomInt(abc.length)]).join('')
}

function pickLogin(code: string): string {
  const base = code.toLowerCase().replace(/[^a-z0-9_.]/g, '')
  const options = [base, `u${base}`, `u${base}_${randomInt(100, 999)}`].filter((l) => /^[a-z0-9_.]{4,20}$/.test(l))
  const free = options.find((l) => !loginTaken(l, config.adminLogin))
  return free ?? `u${randomInt(10_000_000, 99_999_999)}`
}

/**
 * Tanlangan xodimlarni o'qituvchi sifatida olish:
 *   match -> mavjud o'qituvchiga davomat kodi bog'lanadi (yangi hisob ochilmaydi);
 *   new   -> faol o'qituvchi hisobi ochiladi: login = davomat kodi, tasodifiy parol (bir marta qaytariladi).
 * Fanlar bo'sh qoladi: dars jadvali yuklanganda darslaridan to'ldiriladi yoki qo'lda kiritiladi.
 */
export async function importEmployees(codes: string[], scopeBranchId?: string): Promise<DavomatImportResult> {
  if (!Array.isArray(codes) || codes.length === 0) fail(400, 'Kamida bitta xodimni tanlang')
  if (codes.length > 500) fail(400, "Bir martada ko'pi bilan 500 ta xodim")
  const wanted = new Set(codes.map(String))
  const views = (await listEmployees(scopeBranchId)).filter((v) => wanted.has(v.code))
  const branchName = new Map((db().prepare('SELECT id, name FROM branches').all() as { id: string; name: string }[]).map((b) => [b.id, b.name]))
  const result: DavomatImportResult = { linked: [], created: [], skipped: [] }

  for (const code of wanted) if (!views.some((v) => v.code === code)) result.skipped.push(`${code}: topilmadi yoki sizning filialingizda emas`)

  // Parollar hash'i sekin (bcrypt) — tranzaksiyadan oldin tayyorlaymiz
  const prepared = await Promise.all(
    views
      .filter((v) => v.status === 'new')
      .map(async (v) => {
        const password = randomPassword()
        return { v, password, hash: await hashPassword(password) }
      }),
  )

  tx(() => {
    for (const v of views) {
      if (v.status === 'linked') result.skipped.push(`${v.fullName}: allaqachon bog'langan`)
      else if (v.status === 'no_branch') result.skipped.push(`${v.fullName}: "${v.departmentName}" filiali hali sinxronlanmagan`)
      else if (v.status === 'match') {
        db()
          .prepare("UPDATE teachers SET davomat_code = ?, phone = CASE WHEN phone = '' THEN ? ELSE phone END WHERE id = ?")
          .run(v.code, phoneFromCode(v.code), v.teacherId!)
        result.linked.push(v.fullName)
      }
    }
    for (const { v, password, hash } of prepared) {
      const login = pickLogin(v.code)
      db()
        .prepare(
          `INSERT INTO teachers (id, full_name, login, password_hash, status, registered_at, phone, subjects, branch_id, davomat_code)
           VALUES (?, ?, ?, ?, 'active', ?, ?, '[]', ?, ?)`,
        )
        .run(newId('t'), v.fullName, login, hash, localNow().date, phoneFromCode(v.code), v.branchId!, v.code)
      result.created.push({ fullName: v.fullName, login, password, branchName: branchName.get(v.branchId!) ?? '' })
    }
  })
  return result
}
