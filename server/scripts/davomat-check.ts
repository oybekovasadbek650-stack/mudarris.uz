// Davomat integratsiyasini tekshirish (ishlab turgan server + davomat API kerak).
// Ishlatish: node scripts/davomat-check.ts   (server: localhost:8787, davomat: .env dagi DAVOMAT_URL)
// Diqqat: bazaga test yozuvlari qo'shadi (filiallar, o'qituvchilar). Test bazasida ishlating.
import ExcelJS from 'exceljs'

const B = process.env.API ?? 'http://localhost:8787/api'
let ok = 0
let bad = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) ok++
  else bad++
  console.log(`${cond ? 'OK  ' : 'XATO'} ${name}${extra ? '  ' + extra : ''}`)
}
async function call<T = any>(method: string, path: string, body?: unknown, token?: string, form?: FormData): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const r = await fetch(B + path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
  return { status: r.status, data: (await r.json().catch(() => null)) as T }
}
const login = async (l: string, p: string) => (await call('POST', '/auth/login', { login: l, password: p })).data?.token as string

const admin = await login('admin', 'admin123')
const st = await call('GET', '/admin/davomat/status', null, admin)
check('integratsiya yoqilgan', st.data.enabled === true, st.data.url)

const s1 = await call('POST', '/admin/davomat/sync-branches', null, admin)
check('filiallar sinxronlandi (15 ta)', s1.status === 200 && s1.data.total === 15, `qo'shildi: ${s1.data.created?.length}, yangilandi: ${s1.data.updated?.length}`)
const s2 = await call('POST', '/admin/davomat/sync-branches', null, admin)
check('qayta sinxronlash takror yaratmaydi', s2.data.created.length === 0)
const branches = (await call('GET', '/branches')).data as { id: string; name: string; org: string }[]
const org = (n: string) => branches.find((b) => b.name === n)?.org
check("tashkilot turi to'g'ri: Maktab/Kids/Akademiya", org('Maktab Sergeli') === 'school' && org('Kids Izza') === 'kindergarten' && org('Akademiya Yunusobod') === 'academy')
const sergeli = branches.find((b) => b.name === 'Maktab Sergeli')!

const dir = await login('direktor', '123456')
check("sinxronlanmagan filial direktori davomat xodimlarini ko'rmaydi", (await call('GET', '/admin/davomat/employees', null, dir)).data.length === 0)
check('direktor filiallarni sinxronlay olmaydi -> 403', (await call('POST', '/admin/davomat/sync-branches', null, dir)).status === 403)

// Maktab Sergeli'ga direktor + bitta ustoz qo'lda (ismi teskari tartibda) — "match" bo'lishi kerak
await call('PUT', `/admin/branches/${sergeli.id}/director`, { fullName: 'Sergeli Direktori', login: 'sergeli_maktab', password: 'secret12' }, admin)
await call('POST', '/auth/register', { fullName: "Abdulhamid A'zamov", phone: '', branchId: sergeli.id, subjects: ['Informatika'], login: 'abdulhamid_t', password: 'secret12' })
const pending = ((await call('GET', '/admin/teachers', null, admin)).data as any[]).find((t) => t.login === 'abdulhamid_t')
if (pending) await call('POST', `/admin/teachers/${pending.id}/approve`, null, admin)

const sdir = await login('sergeli_maktab', 'secret12')
const emps = (await call('GET', '/admin/davomat/employees', null, sdir)).data as any[]
check("Sergeli direktori 3 xodimni ko'radi", emps.length === 3, emps.map((e) => `${e.fullName}:${e.status}`).join(', '))
check("teskari tartibdagi ism -> 'match' (yangi hisob ochilmaydi)", emps.find((e) => e.code === '918381221')?.status === 'match')

const imp = await call('POST', '/admin/davomat/import', { codes: emps.map((e) => e.code) }, sdir)
check("import: 1 bog'landi, 2 yangi hisob", imp.data.linked?.length === 1 && imp.data.created?.length === 2, JSON.stringify({ linked: imp.data.linked, created: imp.data.created?.map((c: any) => c.login) }))
const cred = imp.data.created[0]
check('yangi ustoz login-paroli bilan kiradi', Boolean(await login(cred.login, cred.password)), cred.login)
const again = await call('POST', '/admin/davomat/import', { codes: emps.map((e) => e.code) }, sdir)
check("qayta import -> hammasi o'tkazildi (allaqachon bog'langan)", again.data.created.length === 0 && again.data.skipped.length === 3)
const teachers = ((await call('GET', '/admin/teachers', null, sdir)).data as any[])
check("Sergeli o'qituvchilari: 3 ta, hammasida davomat kodi", teachers.length === 3 && teachers.every((t) => t.davomatCode), teachers.map((t) => `${t.fullName}/${t.phone}`).join('; '))
check('boshqa filial direktori import qila olmaydi', (await call('POST', '/admin/davomat/import', { codes: ['998080855'] }, dir)).data?.skipped?.length === 1)

// Dars jadvali: ism "Ism Familiya" tartibida -> davomatdagi "Familiya Ism" ga mos tushishi va fanlar to'ldirilishi kerak
const wb = new ExcelJS.Workbook()
const ws = wb.addWorksheet('Dars jadvali')
ws.addRow(['Kun', 'Para', 'Sinf', 'Fan', "O'qituvchi", 'Xona'])
ws.addRow(['Dushanba', 1, '7-A', 'Matematika', 'Xurshidjon Normurodov', '301'])
ws.addRow(['Dushanba', 2, '8-B', 'Fizika', 'Xurshidjon Normurodov', '302'])
ws.addRow(['Seshanba', 1, '7-A', 'Tarix', 'Amirxon Xasanov', '303'])
const form = new FormData()
form.append('file', new Blob([await wb.xlsx.writeBuffer()]), 'sergeli.xlsx')
const sch = await call('POST', '/admin/schedule/import', undefined, sdir, form)
check('jadval: 3 dars, ism teskari tartibda topildi', sch.data.imported === 3, JSON.stringify(sch.data.errors))
const after = ((await call('GET', '/admin/teachers', null, sdir)).data as any[])
const x = after.find((t) => t.davomatCode === '998080855')
check("fani bo'sh ustozga fanlar darslaridan yozildi", JSON.stringify(x?.subjects?.sort()) === JSON.stringify(['Fizika', 'Matematika']), JSON.stringify(x?.subjects))
const a = after.find((t) => t.davomatCode === '918381221')
check("fani bor ustozning fanlari o'zgarmadi", JSON.stringify(a?.subjects) === JSON.stringify(['Informatika']))

console.log(`\n${ok} OK, ${bad} XATO`)
process.exit(bad ? 1 : 0)
