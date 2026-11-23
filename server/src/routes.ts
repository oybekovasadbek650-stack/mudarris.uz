// HTTP API — docs/api.md dagi shartnoma bo'yicha. Hamma yo'llar /api ostida.
//
// Rollar:
//   teacher  — o'qituvchi (Mini App). Mas'ul bo'lsa — o'z filiali holatlarini ko'radi va tasdiqlaydi.
//   director — filial direktori: /admin/* ga kiradi, lekin FAQAT o'z filiali ma'lumotlari.
//   admin    — umumiy rahbariyat: hamma filiallar, filiallar/direktorlarni boshqarish, sozlamalar.
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { changeVersion, emitChange, onChange } from './events.ts'
import { db, newId } from './db.ts'
import { config } from './config.ts'
import { checkPassword, hashPassword, issueToken, safeEqual, verifyInitData, verifyToken, type TokenPayload } from './auth.ts'
import {
  HttpError,
  directorOfBranch,
  directorRow,
  fail,
  getSettings,
  getTeacher,
  lessonsOfBranch,
  lessonsOn,
  listBranches,
  loginTaken,
  meDto,
  teacherDto,
  teacherRow,
  type DirectorRow,
  type TeacherRow,
} from './repo.ts'
import {
  approverLabel,
  caseDto,
  caseRow,
  chooseCandidate,
  coordinatorCases,
  createAbsence,
  dayOverview,
  myOffers,
  mySubstitutions,
  respondOffer,
} from './logic.ts'
import { parseWorkbook } from './excel.ts'
import { importSchedule } from './importer.ts'
import { createLinkUrl } from './telegramLink.ts'
import { davomatEnabled } from './davomat.ts'
import { importEmployees, listEmployees, syncBranches } from './davomatSync.ts'
import { attendanceAvailable, attendanceMissing, openAbsenceForMissing } from './attendance.ts'
import { combinedMonthlyReport } from './reports.ts'
import { dashboardStats } from './stats.ts'
import { branchScope, effectiveSettings, orgScope, putOverride, saveGlobal, settingsTree, validateGlobal, validateOverride } from './settings.ts'
import { isISODate, isMonth, localNow } from './time.ts'
import { decideDirectorRequest, decideTeacher, listDirectorRequests, requestChatRegistration, tgStatus } from './tgRegister.ts'
import type { AdminBranch, Org, Role } from '../../src/types.ts'

type Env = { Variables: { user: TokenPayload } }

export const app = new Hono<Env>().basePath('/api')

app.use('*', cors({ origin: config.corsOrigin, allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PUT'] }))

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ message: err.message }, err.status as 400)
  console.error(err)
  return c.json({ message: "Serverda kutilmagan xato. Keyinroq urinib ko'ring." }, 500)
})
app.notFound((c) => c.json({ message: 'Topilmadi' }, 404))

// Muvaffaqiyatli yozish so'rovidan keyin ochiq sahifalarga "o'zgardi" signali (events.ts)
app.use('*', async (c, next) => {
  await next()
  if (c.req.method !== 'GET' && c.res.status < 400) emitChange()
})

/**
 * Jonli yangilanish oqimi (Server-Sent Events). EventSource sarlavha yubora olmaydi — token ?token= da.
 * Faqat "change" signali keladi (ichida ma'lumot yo'q), sahifa o'zi qayta so'raydi.
 */
app.get('/events', (c) => {
  if (!verifyToken(c.req.query('token') ?? '')) return c.json({ message: 'Avval tizimga kiring' }, 401)
  c.header('X-Accel-Buffering', 'no') // proksi (nginx) oqimni ushlab qolmasin
  // Eslatma: Cloudflare vaqtinchalik tunneli oqimni ushlab qoladi — u holda sahifa /changes ni so'raydi (lib/live.ts)
  return streamSSE(c, async (stream) => {
    let open = true
    const off = onChange(() => void stream.writeSSE({ event: 'change', data: String(Date.now()) }).catch(() => {}))
    stream.onAbort(() => {
      open = false
      off()
    })
    await stream.writeSSE({ event: 'ready', data: '' })
    // Ulanish uzilmasligi uchun har 25 soniyada "ping"
    while (open) {
      await stream.sleep(25_000)
      if (open) await stream.writeSSE({ event: 'ping', data: '' }).catch(() => (open = false))
    }
    off()
  })
})

async function body<T>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T
  } catch {
    return fail(400, "So'rov tanasi noto'g'ri (JSON kutilgan)")
  }
}

const ORG_VALUES: Org[] = ['school', 'academy', 'kindergarten']

/** Me + o'z filialining ish kunlari (Mini App sana tanlovi uchun) */
function meFull(id: string, role: Role) {
  const me = meDto(id, role)
  return me.branchId ? { ...me, workDays: effectiveSettings(me.branchId).workDays } : me
}
const LOGIN_RE = /^[a-z0-9_.]{4,20}$/
const LOGIN_HINT = "Login 4–20 ta lotin harfi, raqam, _ yoki . dan iborat bo'lsin"

// ---------- Ochiq yo'llar ----------

app.get('/health', (c) => c.json({ ok: true, time: localNow() }))

app.get('/branches', (c) => c.json(listBranches()))

app.post('/auth/login', async (c) => {
  const { login, password, initData } = await body<{ login?: string; password?: string; initData?: string }>(c)
  const key = String(login ?? '').trim().toLowerCase()
  const pass = String(password ?? '')
  if (!key || !pass) fail(400, 'Login va parolni kiriting')

  if (key === config.adminLogin) {
    if (!safeEqual(pass, config.adminPassword)) fail(401, "Login yoki parol noto'g'ri")
    return c.json({ token: issueToken('admin', 'admin'), user: meFull('admin', 'admin') })
  }

  // Direktor
  const dir = db().prepare('SELECT * FROM directors WHERE login = ?').get(key) as unknown as DirectorRow | undefined
  if (dir) {
    if (!(await checkPassword(pass, dir.password_hash))) fail(401, "Login yoki parol noto'g'ri")
    return c.json({ token: issueToken(dir.id, 'director'), user: meFull(dir.id, 'director') })
  }

  // O'qituvchi
  const row = db().prepare('SELECT * FROM teachers WHERE login = ?').get(key) as unknown as TeacherRow | undefined
  if (!row || !(await checkPassword(pass, row.password_hash))) fail(401, "Login yoki parol noto'g'ri")
  if (row!.status === 'pending') fail(403, 'Hisobingiz hali tasdiqlanmagan. Rahbariyat tasdiqlashini kuting.')
  if (row!.status === 'rejected') fail(403, "Ro'yxatdan o'tish arizangiz rad etilgan. Rahbariyat bilan bog'laning.")

  // Telegram ichidan kirilgan bo'lsa — shu Telegram akkauntni o'qituvchiga bog'laymiz
  if (initData) {
    const tgUser = verifyInitData(initData, config.botToken)
    if (tgUser) {
      db().prepare('UPDATE teachers SET telegram_id = NULL WHERE telegram_id = ? AND id != ?').run(tgUser.id, row!.id)
      db().prepare('UPDATE teachers SET telegram_id = ? WHERE id = ?').run(tgUser.id, row!.id)
    }
  }
  return c.json({ token: issueToken(row!.id, 'teacher'), user: meFull(row!.id, 'teacher') })
})

/** Telegram ichida bog'langan o'qituvchi parolsiz kiradi (initData orqali) */
app.post('/auth/telegram', async (c) => {
  const { initData } = await body<{ initData?: string }>(c)
  const tgUser = verifyInitData(String(initData ?? ''), config.botToken)
  if (!tgUser) fail(401, 'Telegram maʼlumotlari tasdiqlanmadi')
  const row = db().prepare("SELECT * FROM teachers WHERE telegram_id = ? AND status = 'active'").get(tgUser!.id) as unknown as
    | TeacherRow
    | undefined
  if (!row) fail(404, 'Bu Telegram akkaunt hali hech bir hisobga bogʻlanmagan')
  return c.json({ token: issueToken(row!.id, 'teacher'), user: meFull(row!.id, 'teacher') })
})

// ---------- Bot ichida ro'yxatdan o'tish (tgRegister.ts) ----------
app.post('/auth/tg-status', async (c) => c.json(tgStatus((await body<{ initData?: string }>(c)).initData)))
// Ro'yxat bot chatining o'zida: Mini App faqat botga "savollarni boshla" deydi
app.post('/auth/tg-chat-register', async (c) => c.json(requestChatRegistration((await body<{ initData?: string }>(c)).initData)))

app.post('/auth/register', async (c) => {
  const input = await body<{ fullName?: string; phone?: string; branchId?: string; subjects?: string[]; login?: string; password?: string }>(c)
  const fullName = String(input.fullName ?? '').trim()
  const login = String(input.login ?? '').trim().toLowerCase()
  const password = String(input.password ?? '')
  const subjects = Array.isArray(input.subjects) ? [...new Set(input.subjects.map((s) => String(s).trim()).filter(Boolean))] : []
  if (fullName.split(/\s+/).length < 2) fail(400, "Ism va familiyani to'liq yozing")
  if (!LOGIN_RE.test(login)) fail(400, LOGIN_HINT)
  if (loginTaken(login, config.adminLogin)) fail(409, 'Bu login band, boshqasini tanlang')
  if (password.length < 6) fail(400, "Parol kamida 6 ta belgidan iborat bo'lsin")
  if (subjects.length === 0) fail(400, 'Kamida bitta fanni tanlang')
  if (!db().prepare('SELECT 1 FROM branches WHERE id = ?').get(String(input.branchId ?? ''))) fail(400, 'Filialni tanlang')

  db()
    .prepare(
      `INSERT INTO teachers (id, full_name, login, password_hash, status, registered_at, phone, subjects, branch_id)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    )
    .run(newId('t'), fullName, login, await hashPassword(password), localNow().date, String(input.phone ?? '').trim(), JSON.stringify(subjects), String(input.branchId))
  return c.json({ status: 'pending' })
})

// ---------- Token talab qilinadigan yo'llar ----------

app.use('*', async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const payload = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null
  if (!payload) return c.json({ message: 'Avval tizimga kiring' }, 401)
  if (payload.role === 'teacher') {
    const row = teacherRow(payload.sub)
    if (!row || row.status !== 'active') return c.json({ message: 'Hisob faol emas' }, 401)
  }
  if (payload.role === 'director' && !directorRow(payload.sub)) return c.json({ message: 'Hisob topilmadi' }, 401)
  c.set('user', payload)
  await next()
})

const teacherId = (c: Context<Env>) => {
  const u = c.get('user')
  if (u.role !== 'teacher') fail(403, "Bu bo'lim faqat o'qituvchilar uchun")
  return u.sub
}
const actorOf = (c: Context<Env>) => ({ role: c.get('user').role, id: c.get('user').sub })

app.get('/me', (c) => c.json(meFull(c.get('user').sub, c.get('user').role)))

/** Zaxira jonli yangilanish: o'zgarishlar hisoblagichi (SSE o'tmasa sahifa har 3 s so'raydi) */
app.get('/changes', (c) => c.json({ v: changeVersion() }))

/** Telegram'ni bog'lash havolasi (o'qituvchi va direktor uchun) */
app.post('/me/telegram-link', (c) => {
  const u = c.get('user')
  if (u.role === 'admin') fail(400, "Umumiy rahbariyat hisobini Telegram'ga bog'lab bo'lmaydi")
  return c.json(createLinkUrl(u.role === 'director' ? 'director' : 'teacher', u.sub))
})

app.get('/me/lessons', (c) => {
  const date = c.req.query('date') ?? localNow().date
  if (!isISODate(date)) fail(400, "Sana noto'g'ri")
  return c.json(lessonsOn(teacherId(c), date))
})
app.get('/me/offers', (c) => c.json(myOffers(teacherId(c))))
app.get('/me/substitutions', (c) => c.json(mySubstitutions(teacherId(c))))
app.post('/offers/:id/accept', (c) => c.json(respondOffer(teacherId(c), c.req.param('id'), true)))
app.post('/offers/:id/reject', (c) => c.json(respondOffer(teacherId(c), c.req.param('id'), false)))
app.post('/absences', async (c) => {
  const id = teacherId(c)
  return c.json(createAbsence(id, await body(c)))
})

// Mas'ul shaxs (Mini App)
app.get('/cases', (c) => c.json(coordinatorCases(teacherId(c))))
app.get('/cases/:id', (c) => {
  const row = caseRow(c.req.param('id'))
  if (!row) fail(404, 'Holat topilmadi')
  approverLabel(actorOf(c), row!) // ruxsat tekshiruvi
  return c.json(caseDto(row!))
})
app.post('/cases/:id/choose', async (c) => {
  const { teacherId: chosen } = await body<{ teacherId?: string }>(c)
  return c.json(chooseCandidate(actorOf(c), c.req.param('id'), String(chosen ?? '')))
})

// ---------- Panel: rahbariyat va direktor ----------

app.use('/admin/*', async (c, next) => {
  const role = c.get('user').role
  if (role !== 'admin' && role !== 'director') return c.json({ message: 'Faqat rahbariyat uchun' }, 403)
  await next()
})

/** Direktor bo'lsa — uning filiali (hamma so'rovlar shu bilan cheklanadi); rahbariyat uchun undefined */
const scopeBranch = (c: Context<Env>): string | undefined => {
  const u = c.get('user')
  return u.role === 'director' ? directorRow(u.sub)!.branch_id : undefined
}
const adminOnly = (c: Context<Env>) => {
  if (c.get('user').role !== 'admin') fail(403, "Bu amal faqat umumiy rahbariyat uchun")
}
/** Direktor faqat o'z filiali o'qituvchisi bilan ishlay oladi */
const teacherInScope = (c: Context<Env>, id: string) => {
  const t = getTeacher(id)
  const scope = scopeBranch(c)
  if (scope && t.branchId !== scope) fail(403, "Bu o'qituvchi boshqa filialga tegishli")
  return t
}

app.get('/admin/overview', (c) => {
  const date = c.req.query('date') ?? localNow().date
  if (!isISODate(date)) fail(400, "Sana noto'g'ri")
  return c.json(dayOverview(date, scopeBranch(c) ?? (c.req.query('branchId') || undefined)))
})

/** 7 kunlik trend (tanlangan sanagacha) va yaqin 7 kundagi arizalar */
app.get('/admin/stats', (c) => {
  const to = c.req.query('to') ?? localNow().date
  if (!isISODate(to)) fail(400, "Sana noto'g'ri")
  const org = c.req.query('org')
  const orgFilter = org && ORG_VALUES.includes(org as Org) ? (org as Org) : undefined
  const days = Math.min(62, Math.max(1, Number(c.req.query('days') ?? 7) || 7))
  return c.json(dashboardStats(to, scopeBranch(c) ?? (c.req.query('branchId') || undefined), scopeBranch(c) ? undefined : orgFilter, days))
})

app.get('/admin/schedule', (c) => c.json(lessonsOfBranch(scopeBranch(c) ?? c.req.query('branchId') ?? '')))

app.post('/admin/schedule/import', async (c) => {
  const form = await c.req.parseBody()
  const file = form.file
  if (!(file instanceof File)) fail(400, 'Fayl yuborilmadi')
  const f = file as File
  if (f.size > 5 * 1024 * 1024) fail(400, "Fayl juda katta (5 MB dan oshmasin)")
  if (!/\.xlsx$/i.test(f.name)) fail(400, 'Faqat .xlsx fayl qabul qilinadi')
  let wb
  try {
    wb = await parseWorkbook(await f.arrayBuffer())
  } catch {
    return fail(400, "Faylni o'qib bo'lmadi. Excel (.xlsx) ekanini tekshiring.")
  }
  return c.json(importSchedule(wb, scopeBranch(c)))
})

app.get('/admin/teachers', (c) => {
  const scope = scopeBranch(c)
  const rows = (
    scope
      ? db().prepare('SELECT * FROM teachers WHERE branch_id = ? ORDER BY status, full_name').all(scope)
      : db().prepare('SELECT * FROM teachers ORDER BY status, full_name').all()
  ) as unknown as TeacherRow[]
  return c.json(rows.map(teacherDto))
})

app.put('/admin/teachers/:id', async (c) => {
  const id = c.req.param('id')
  teacherInScope(c, id)
  const input = await body<{ fullName?: string; phone?: string; subjects?: string[]; extraSubjects?: string[]; branchId?: string; isCoordinator?: boolean }>(c)
  const clean = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((s) => String(s).trim()).filter(Boolean))] : [])
  const fullName = String(input.fullName ?? '').trim()
  const subjects = clean(input.subjects)
  const branchId = scopeBranch(c) ?? String(input.branchId ?? '') // direktor boshqa filialga o'tkaza olmaydi
  if (!fullName) fail(400, 'Ism-familiyani kiriting')
  if (subjects.length === 0) fail(400, 'Kamida bitta fan kiriting')
  if (!db().prepare('SELECT 1 FROM branches WHERE id = ?').get(branchId)) fail(400, 'Filialni tanlang')
  db()
    .prepare('UPDATE teachers SET full_name = ?, phone = ?, subjects = ?, extra_subjects = ?, branch_id = ?, is_coordinator = ? WHERE id = ?')
    .run(fullName, String(input.phone ?? '').trim(), JSON.stringify(subjects), JSON.stringify(clean(input.extraSubjects)), branchId, input.isCoordinator ? 1 : 0, id)
  return c.json(getTeacher(id))
})

for (const [action, status] of [['approve', 'active'], ['reject', 'rejected']] as const) {
  app.post(`/admin/teachers/:id/${action}`, (c) => {
    const id = c.req.param('id')
    teacherInScope(c, id)
    return c.json(decideTeacher(id, status))
  })
}

/** Paneldan o'rinbosarni tasdiqlash (direktor — o'z filiali, rahbariyat — hammasi) */
app.post('/admin/cases/:id/choose', async (c) => {
  const { teacherId: chosen } = await body<{ teacherId?: string }>(c)
  return c.json(chooseCandidate(actorOf(c), c.req.param('id'), String(chosen ?? '')))
})

/** Rahbariyat — umumiy sozlamalar; direktor — o'z filialida amaldagi (birlashtirilgan) sozlamalar */
app.get('/admin/settings', (c) => {
  const scope = scopeBranch(c)
  return c.json(scope ? effectiveSettings(scope) : getSettings())
})
/** Umumiy sozlamalar — faqat rahbariyat */
app.put('/admin/settings', async (c) => {
  adminOnly(c)
  const next = validateGlobal(await body<Record<string, unknown>>(c))
  saveGlobal(next)
  return c.json(next)
})

/** Hamma darajalar: umumiy, tashkilot turlari, filiallar (direktor — faqat o'z filiali va tashkiloti) */
app.get('/admin/settings/tree', (c) => c.json(settingsTree(scopeBranch(c))))

/**
 * Tashkilot turi yoki filial uchun qayta belgilash. values — faqat o'zgartirilgan maydonlar (bo'sh = merosga qaytarish).
 * Rahbariyat — istalgan daraja; direktor — faqat o'z filiali.
 */
app.put('/admin/settings/override', async (c) => {
  const { scope, id, values } = await body<{ scope?: string; id?: string; values?: Record<string, unknown> }>(c)
  const own = scopeBranch(c)
  let key: string
  if (scope === 'org') {
    adminOnly(c)
    if (!['school', 'academy', 'kindergarten'].includes(String(id))) fail(400, "Tashkilot turi noto'g'ri")
    key = orgScope(id as Org)
  } else if (scope === 'branch') {
    if (!db().prepare('SELECT 1 FROM branches WHERE id = ?').get(String(id ?? ''))) fail(404, 'Filial topilmadi')
    if (own && own !== id) fail(403, "Faqat o'z filialingiz sozlamalarini o'zgartira olasiz")
    key = branchScope(String(id))
  } else {
    return fail(400, "scope 'org' yoki 'branch' bo'lishi kerak")
  }
  putOverride(key, validateOverride(values ?? {}))
  return c.json(settingsTree(own))
})

app.get('/admin/reports/monthly', async (c) => {
  const month = c.req.query('month') ?? localNow().date.slice(0, 7)
  if (!isMonth(month)) fail(400, "Oy noto'g'ri")
  return c.json(await combinedMonthlyReport(month, scopeBranch(c)))
})

// ---------- Davomat tizimi integratsiyasi ----------

app.get('/admin/davomat/status', (c) => c.json({ enabled: davomatEnabled(), url: davomatEnabled() ? config.davomatUrl : '' }))

/** Davomatdagi filiallarni bizga qo'shish/yangilash — faqat umumiy rahbariyat */
app.post('/admin/davomat/sync-branches', async (c) => {
  adminOnly(c)
  return c.json(await syncBranches())
})

/** Davomatdagi xodimlar (direktor — faqat o'z filiali) */
app.get('/admin/davomat/employees', async (c) => c.json(await listEmployees(scopeBranch(c))))

/** Tanlangan xodimlarni o'qituvchi sifatida olish */
app.post('/admin/davomat/import', async (c) => {
  const { codes } = await body<{ codes?: string[] }>(c)
  return c.json(await importEmployees(Array.isArray(codes) ? codes : [], scopeBranch(c)))
})

/** Davomat bo'yicha hali kelmagan ustozlar (bot so'ragan / direktorga xabar berilgan) */
app.get('/admin/attendance/missing', (c) => {
  const date = c.req.query('date') ?? localNow().date
  if (!isISODate(date)) fail(400, "Sana noto'g'ri")
  return c.json({ enabled: attendanceAvailable(), items: attendanceMissing(date, scopeBranch(c)) })
})

/** Kelmagan ustoz uchun arizani direktor/rahbariyat ochadi -> o'rinbosar qidiriladi */
app.post('/admin/attendance/absence', async (c) => {
  const { teacherId: tid, date } = await body<{ teacherId?: string; date?: string }>(c)
  const d = date ?? localNow().date
  if (!isISODate(d)) fail(400, "Sana noto'g'ri")
  return c.json(openAbsenceForMissing(actorOf(c), String(tid ?? ''), d))
})

// ---------- Filiallar va direktorlar (faqat umumiy rahbariyat) ----------

function adminBranchDto(b: { id: string; name: string; org: Org }): AdminBranch {
  const d = directorOfBranch(b.id)
  const teachersCount = (db().prepare("SELECT COUNT(*) n FROM teachers WHERE branch_id = ? AND status = 'active'").get(b.id) as { n: number }).n
  return {
    ...b,
    director: d ? { id: d.id, fullName: d.full_name, login: d.login, phone: d.phone, telegramLinked: d.telegram_id != null } : null,
    teachersCount,
  }
}

/** Botdan kelgan direktorlik arizalari — faqat umumiy rahbariyat ko'radi va tasdiqlaydi */
app.get('/admin/director-requests', (c) => {
  adminOnly(c)
  return c.json(listDirectorRequests())
})
for (const [action, approve] of [['approve', true], ['reject', false]] as const) {
  app.post(`/admin/director-requests/:id/${action}`, async (c) => {
    adminOnly(c)
    return c.json(await decideDirectorRequest(c.req.param('id'), approve))
  })
}

app.get('/admin/branches', (c) => {
  adminOnly(c)
  return c.json(listBranches().map(adminBranchDto))
})

async function branchInput(c: Context<Env>) {
  const input = await body<{ name?: string; org?: string }>(c)
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim() // "Ibn sino  Maktabi" -> bitta bo'sh joy
  const org = String(input.org ?? '') as Org
  if (name.length < 3) fail(400, 'Filial nomini kiriting (kamida 3 harf)')
  if (name.length > 80) fail(400, 'Filial nomi juda uzun')
  if (!ORG_VALUES.includes(org)) fail(400, "Tashkilot turini tanlang: maktab, akademiya yoki bog'cha")
  return { name, org }
}

app.post('/admin/branches', async (c) => {
  adminOnly(c)
  const { name, org } = await branchInput(c)
  if (db().prepare('SELECT 1 FROM branches WHERE name = ?').get(name)) fail(409, 'Bu nomli filial allaqachon bor')
  const id = newId('b')
  db().prepare('INSERT INTO branches (id, name, org) VALUES (?, ?, ?)').run(id, name, org)
  return c.json(adminBranchDto({ id, name, org }))
})

app.put('/admin/branches/:id', async (c) => {
  adminOnly(c)
  const id = c.req.param('id')
  if (!db().prepare('SELECT 1 FROM branches WHERE id = ?').get(id)) fail(404, 'Filial topilmadi')
  const { name, org } = await branchInput(c)
  if (db().prepare('SELECT 1 FROM branches WHERE name = ? AND id != ?').get(name, id)) fail(409, 'Bu nomli filial allaqachon bor')
  db().prepare('UPDATE branches SET name = ?, org = ? WHERE id = ?').run(name, org, id)
  return c.json(adminBranchDto({ id, name, org }))
})

/** Filial direktorini tayinlash yoki tahrirlash. Yangi direktor uchun parol majburiy. */
app.put('/admin/branches/:id/director', async (c) => {
  adminOnly(c)
  const branchId = c.req.param('id')
  const branch = db().prepare('SELECT id, name, org FROM branches WHERE id = ?').get(branchId) as { id: string; name: string; org: Org } | undefined
  if (!branch) fail(404, 'Filial topilmadi')
  const input = await body<{ fullName?: string; login?: string; phone?: string; password?: string }>(c)
  const fullName = String(input.fullName ?? '').trim()
  const login = String(input.login ?? '').trim().toLowerCase()
  const rawPhone = String(input.phone ?? '').trim()
  const phone = rawPhone.replace(/\s/g, '') === '+998' ? '' : rawPhone // faqat prefiks — raqam yo'q
  const password = String(input.password ?? '')
  const existing = directorOfBranch(branchId)

  if (fullName.split(/\s+/).length < 2) fail(400, "Direktorning ism va familiyasini to'liq yozing")
  if (!LOGIN_RE.test(login)) fail(400, LOGIN_HINT)
  if (loginTaken(login, config.adminLogin, existing?.id)) fail(409, 'Bu login band, boshqasini tanlang')
  if (!existing && password.length < 6) fail(400, "Parol kamida 6 ta belgidan iborat bo'lsin")
  if (existing && password && password.length < 6) fail(400, "Yangi parol kamida 6 ta belgidan iborat bo'lsin")

  if (existing) {
    db().prepare('UPDATE directors SET full_name = ?, login = ?, phone = ? WHERE id = ?').run(fullName, login, phone, existing.id)
    if (password) db().prepare('UPDATE directors SET password_hash = ? WHERE id = ?').run(await hashPassword(password), existing.id)
  } else {
    db()
      .prepare('INSERT INTO directors (id, full_name, login, password_hash, phone, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(newId('d'), fullName, login, await hashPassword(password), phone, branchId, localNow().date)
  }
  return c.json(adminBranchDto(branch!))
})
