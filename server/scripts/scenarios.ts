// "Test ssenariylari" varag'i bo'yicha o'rinbosar topish mantig'ini tekshirish.
// Ishlatish: node scripts/scenarios.ts [excel-fayl]
// Har ssenariy toza (xotiradagi) bazada ishlaydi: Excel'dan to'ldiriladi -> ariza -> natija "Kutilgan natija" bilan solishtiriladi.
import { readFileSync } from 'node:fs'
import { openDb, db } from '../src/db.ts'
import { parseWorkbook, norm } from '../src/excel.ts'
import { seedFromWorkbook } from '../src/importer.ts'
import { createAbsence, respondOffer, caseDto, expireStaleOffers, offerDto, monthlyReport, offerDeadline } from '../src/logic.ts'
import { branchScope, effectiveSettings, orgScope, putOverride, validateOverride } from '../src/settings.ts'
import { getSettings, lessonsOn, putSettings } from '../src/repo.ts'
import { attendanceMissing, attendanceSweep, openAbsenceForMissing, teacherAttendanceReply } from '../src/attendance.ts'
import { davomatEmployeeId } from '../src/davomat.ts'
import { setNotifier } from '../src/notify.ts'
import { clock, localNow, tashkent, weekdayOf } from '../src/time.ts'
import type { CaseRow, OfferRow } from '../src/repo.ts'
import { createHmac } from 'node:crypto'
import { config } from '../src/config.ts'
import {
  branchSubjects,
  decideTeacher,
  formatPhone,
  issuePassword,
  loginBase,
  makeLogin,
  nameError,
  parsePhone,
  registerTelegramUser,
  saveContact,
  requestChatRegistration,
  requestDirector,
  listDirectorRequests,
  decideDirectorRequest,
  tgStatus,
} from '../src/tgRegister.ts'

const file = process.argv[2] ?? process.env.XLSX ?? 'data/orinbosar_test_jadvali.xlsx'
const wb = await parseWorkbook(readFileSync(file))
if (wb.scenarios.length === 0) {
  console.error('Faylda "Test ssenariylari" topilmadi')
  process.exit(1)
}

/** 2026-11-23 (dushanba) dan boshlab kerakli hafta kuniga to'g'ri keladigan sana */
function dateFor(weekday: number) {
  let d = Date.parse('2026-11-23T00:00:00Z')
  while (weekdayOf(new Date(d).toISOString().slice(0, 10)) !== weekday) d += 86_400_000
  return new Date(d).toISOString().slice(0, 10)
}

const groups = [...new Set(wb.scenarios.map((s) => s.no))]
let passed = 0
let failed = 0

for (const no of groups) {
  const rows = wb.scenarios.filter((s) => s.no === no)
  const first = rows[0]
  openDb(':memory:')
  await seedFromWorkbook(wb, 'test123')

  const teacher = db().prepare('SELECT id FROM teachers WHERE full_name = ?').get(first.teacherName) as { id: string }
  const date = dateFor(first.weekday)
  const lateTime = /(\d{1,2}:\d{2})\s*da xabar/.exec(rows.map((r) => r.expected).join(' '))?.[1]
  clock.now = () => tashkent(date, lateTime ?? '06:00')

  const lessonIds = lessonsOn(teacher.id, date)
    .filter((l) => rows.some((r) => r.para === l.para))
    .map((l) => l.id)
  createAbsence(teacher.id, { date, reason: `Ssenariy ${no}`, lessonIds })

  const cases = db().prepare('SELECT * FROM cases').all() as unknown as CaseRow[]
  const offersOf = (caseId: string) =>
    db().prepare("SELECT * FROM offers WHERE case_id = ? ORDER BY rank").all(caseId) as unknown as OfferRow[]
  const nameOf = (id: string) => (db().prepare('SELECT full_name FROM teachers WHERE id = ?').get(id) as { full_name: string }).full_name

  // "Rad etaman" ssenariysi: birinchi nomzod rad etadi
  for (const r of rows.filter((r) => /rad etaman/i.test(r.expected))) {
    const c = cases.find((c) => JSON.parse(c.lesson_json).para === r.para)
    const o = c && offersOf(c.id)[0]
    if (o) respondOffer(o.teacher_id, o.id, false)
  }

  for (const r of rows) {
    const c = (db().prepare('SELECT * FROM cases').all() as unknown as CaseRow[]).find((c) => JSON.parse(c.lesson_json).para === r.para)
    const label = `#${no} ${['', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'][r.weekday]} ${r.para}-para ${r.className} ${r.subject}`
    const problems: string[] = []
    let got = '—'
    if (!c) problems.push('holat yaratilmadi')
    else {
      const dto = caseDto(c)
      const lesson = dto.lesson
      if (lesson.className !== r.className || lesson.subject !== r.subject) problems.push(`dars mos emas: ${lesson.className} ${lesson.subject}`)
      const active = offersOf(c.id).filter((o) => o.status === 'pending' || o.status === 'accepted')
      got = c.status === 'not_found' ? "topilmadi" : active.map((o) => nameOf(o.teacher_id)).join(', ') || '—'

      // Kutilgan natija: oxirgi tilga olingan ustoz (masalan "Test Ustoz 1 rad etadi -> ..." bo'lsa nomzod yo'q)
      const expectsNone = /nomzod yo'q|topilmadi/i.test(norm(r.expected))
      const expectedName = /test ustoz \d+/i.exec(r.expected)?.[0]
      if (expectsNone) {
        if (c.status !== 'not_found') problems.push(`"topilmadi" kutilgan, holat: ${c.status}`)
      } else if (expectedName) {
        const top = active[0] && nameOf(active[0].teacher_id)
        if (norm(top ?? '') !== norm(expectedName)) problems.push(`birinchi nomzod "${expectedName}" kutilgan`)
      }
      if (lateTime && !dto.lateNotice) problems.push('"Kech xabar berildi" belgisi yo\'q')
    }
    if (problems.length === 0) passed++
    else failed++
    console.log(`${problems.length === 0 ? 'OK  ' : 'XATO'} ${label.padEnd(34)} natija: ${got.padEnd(28)} kutilgan: ${r.expected}`)
    problems.forEach((p) => console.log(`       -> ${p}`))
  }
}

// ---------- Qo'shimcha: taklifga javob berish muddati ----------
console.log("\nQo'shimcha: taklifga javob berish muddati")
const extra = (name: string, ok: boolean, info = '') => {
  if (ok) passed++
  else failed++
  console.log(`${ok ? 'OK  ' : 'XATO'} ${name}${info ? `  (${info})` : ''}`)
}
async function timeoutCase(minutes?: number) {
  openDb(':memory:')
  await seedFromWorkbook(wb, 'test123')
  if (minutes) putSettings({ ...getSettings(), offerTimeoutMinutes: minutes })
  const t2 = (db().prepare("SELECT id FROM teachers WHERE full_name = 'Test Ustoz 2'").get() as { id: string }).id
  const date = dateFor(2) // seshanba: Ustoz 2 ning 1-parasi uchun yagona nomzod — Ustoz 1
  clock.now = () => tashkent(date, '06:00')
  const lesson = lessonsOn(t2, date).find((l) => l.para === 1)!
  createAbsence(t2, { date, reason: 'Muddat testi', lessonIds: [lesson.id] })
  const c = db().prepare('SELECT * FROM cases').get() as unknown as CaseRow
  const offer = db().prepare('SELECT * FROM offers WHERE case_id = ?').get(c.id) as unknown as OfferRow
  const at = (min: number) => (clock.now = () => new Date(tashkent(date, '06:00').getTime() + min * 60_000))
  const status = () => ({
    offer: (db().prepare('SELECT status FROM offers WHERE id = ?').get(offer.id) as { status: string }).status,
    case: (db().prepare('SELECT status FROM cases WHERE id = ?').get(c.id) as { status: string }).status,
  })
  return { offer, at, status }
}

{
  const { offer, at, status } = await timeoutCase()
  extra('standart muddat 30 daqiqa', getSettings().offerTimeoutMinutes === 30)
  extra('taklifda expiresAt = yaratilgan + 30 daqiqa', offerDto(offer).expiresAt === new Date(Date.parse(offer.created_at) + 30 * 60_000).toISOString())
  at(29)
  expireStaleOffers()
  extra("29-daqiqada taklif hali ochiq", status().offer === 'pending' && status().case === 'pending', JSON.stringify(status()))
  at(31)
  const r = expireStaleOffers()
  extra("31-daqiqada taklif yopildi, boshqa nomzod yo'q -> topilmadi", r.expired.length === 1 && status().offer === 'expired' && status().case === 'not_found', JSON.stringify(status()))
}
{
  const { offer, at } = await timeoutCase()
  at(45) // fon tekshiruvi hali ishlamagan, ustoz kech bosdi
  let msg = ''
  try {
    respondOffer(offer.teacher_id, offer.id, true)
  } catch (e) {
    msg = (e as Error).message
  }
  extra('muddatdan keyin "Qabul qilaman" rad etiladi', msg.includes("o'tib ketdi"), msg)
}
{
  const { at, status } = await timeoutCase(10)
  at(11)
  expireStaleOffers()
  extra('sozlamadagi 10 daqiqa hisobga olinadi', status().offer === 'expired', JSON.stringify(status()))
}
{
  const { offer, at, status } = await timeoutCase()
  at(10)
  respondOffer(offer.teacher_id, offer.id, true)
  at(60)
  expireStaleOffers()
  extra('qabul qilingan taklif muddat bilan yopilmaydi', status().offer === 'accepted' && status().case === 'pending', JSON.stringify(status()))
}

// ---------- Qo'shimcha: davomat bo'yicha "kelmadi" signali (2-bosqich) ----------
console.log("\nQo'shimcha: davomat bo'yicha \"kelmadi\" signali")
{
  openDb(':memory:')
  await seedFromWorkbook(wb, 'test123')
  putSettings({ ...getSettings(), attendanceCheck: true, attendanceAskMinutes: 30, attendanceEscalateMinutes: 15 })
  const id = (n: number) => (db().prepare('SELECT id FROM teachers WHERE full_name = ?').get(`Test Ustoz ${n}`) as { id: string }).id
  const [T1, T2, T3] = [id(1), id(2), id(3)]
  // T1 va T3 — Telegram ulangan, T2 — ulanmagan; uchalasi davomatga bog'langan. T4 — davomatda yo'q (tekshirilmaydi)
  db().prepare("UPDATE teachers SET davomat_code = '901000001', telegram_id = 111 WHERE id = ?").run(T1)
  db().prepare("UPDATE teachers SET davomat_code = '901000002' WHERE id = ?").run(T2)
  db().prepare("UPDATE teachers SET davomat_code = '901000003', telegram_id = 333 WHERE id = ?").run(T3)

  const events: string[] = []
  setNotifier({
    attendanceAsk: (t) => events.push(`ask:${t}`),
    attendanceEscalate: (t, _d, r) => events.push(`esc:${t}:${r}`),
    attendanceComing: (t) => events.push(`coming:${t}`),
  })
  let present = new Set<string>()
  const sweep = () => attendanceSweep(async () => present)
  const WED = dateFor(3) // chorshanba: T2 va T3 1-para 08:30, T1 2-para 09:20
  const at = (date: string, time: string) => (clock.now = () => tashkent(date, time))
  const stageOf = (t: string, d: string) => (db().prepare('SELECT stage FROM attendance_checks WHERE teacher_id = ? AND date = ?').get(t, d) as { stage: string } | undefined)?.stage

  at(WED, '07:50')
  let r = await sweep()
  extra("07:50 — hali erta, hech kimdan so'ralmaydi", r.asked.length === 0 && r.escalated.length === 0)

  at(WED, '08:00')
  r = await sweep()
  extra("08:00 — T3 dan botda so'raldi (darsdan 30 daq oldin)", r.asked.includes(T3) && events.includes(`ask:${T3}`))
  extra("08:00 — T2 Telegram'siz: darhol direktor/mas'ulga", r.escalated.includes(T2) && events.includes(`esc:${T2}:no_telegram`))
  extra("08:00 — T1 ning darsi 09:20, hali tekshirilmaydi", !stageOf(T1, WED))

  at(WED, '08:10')
  r = await sweep()
  extra('08:10 — T3 javobi kutilmoqda (15 daq hali o\'tmadi)', stageOf(T3, WED) === 'asked' && r.escalated.length === 0)

  at(WED, '08:15')
  r = await sweep()
  extra("08:15 — T3 javob bermadi -> direktor/mas'ulga", r.escalated.includes(T3) && events.includes(`esc:${T3}:no_answer`))
  extra("panelda 2 ta 'hali kelmagan'", attendanceMissing(WED).length === 2)

  teacherAttendanceReply(T3, WED, true)
  extra("T3 kech bo'lsa ham 'kelyapman' dedi -> stage=coming, mas'ulga xabar", stageOf(T3, WED) === 'coming' && events.includes(`coming:${T3}`))
  extra("panelda endi 1 ta (T2)", attendanceMissing(WED).map((m) => m.teacherId).join() === T2)

  present = new Set(['901000001'])
  at(WED, '08:50')
  r = await sweep()
  extra('08:50 — T1 davomatda keldi -> hech kim bezovta qilinmaydi', r.present.includes(T1) && !events.includes(`ask:${T1}`))

  at(WED, '08:20')
  const coord = { role: 'teacher' as const, id: T1 } // T1 — mas'ul
  const opened = openAbsenceForMissing(coord, T2, WED)
  extra("mas'ul T2 uchun arizani ochdi -> 3 dars uchun qidiruv", opened.casesCount === 3, JSON.stringify(opened))
  let dup = ''
  try {
    openAbsenceForMissing(coord, T2, WED)
  } catch (e) {
    dup = (e as Error).message
  }
  extra('takror bosish -> "allaqachon ochilgan"', dup.includes('allaqachon'), dup)
  let notCoord = ''
  try {
    openAbsenceForMissing({ role: 'teacher', id: T3 }, T2, WED)
  } catch (e) {
    notCoord = (e as Error).message
  }
  extra("oddiy ustoz (mas'ul emas) ariza ocha olmaydi", notCoord.includes("mas'ul"), notCoord)

  const THU = dateFor(4) // payshanba: T3 1-para 08:30
  at(THU, '08:00')
  await sweep()
  const rep = teacherAttendanceReply(T3, THU, false)
  extra('T3 "Kela olmayman" -> ariza ochildi (3 dars)', rep.stage === 'absence_created' && rep.casesCount === 3, JSON.stringify(rep))
  extra("arizasi bor ustoz 'hali kelmagan'larda ko'rinmaydi", !attendanceMissing(THU).some((m) => m.teacherId === T3))

  at(dateFor(7), '08:00')
  extra('yakshanba (ish kuni emas) — tekshiruv ishlamaydi', (await sweep()).skipped === 'dam olish kuni')
  putSettings({ ...getSettings(), attendanceCheck: false })
  at(WED, '08:00')
  extra("sozlamada o'chiq — tekshiruv ishlamaydi", (await sweep()).skipped === "sozlamada o'chiq")
  extra("davomat ID: raqamli kod — o'zi, boshqasi — crc32 (python zlib bilan bir xil)", davomatEmployeeId('0901') === '901' && davomatEmployeeId('abc') === '891568578')
}

// ---------- Qo'shimcha: filial bo'yicha sozlamalar (umumiy -> tashkilot turi -> filial) ----------
console.log("\nQo'shimcha: filial bo'yicha sozlamalar")
{
  openDb(':memory:')
  await seedFromWorkbook(wb, 'test123')
  const branch = (db().prepare('SELECT id FROM branches').get() as { id: string }).id // Test filial (maktab)
  const id = (n: number) => (db().prepare('SELECT id FROM teachers WHERE full_name = ?').get(`Test Ustoz ${n}`) as { id: string }).id
  const [T1, T2] = [id(1), id(2)]

  extra("standart: filial umumiy sozlamani oladi", effectiveSettings(branch).dailyLimit === 2 && effectiveSettings(branch).workDays.join() === '1,2,3,4,5,6')
  putOverride(orgScope('school'), validateOverride({ dailyLimit: 3, noticeDeadline: '08:00' }))
  extra('tashkilot turi (maktab) qiymati filialga o\'tadi', effectiveSettings(branch).dailyLimit === 3 && effectiveSettings(branch).noticeDeadline === '08:00')
  putOverride(branchScope(branch), validateOverride({ noticeDeadline: '06:30', paymentPerLesson: 40000 }))
  const eff = effectiveSettings(branch)
  extra('filial qiymati tashkilotnikidan ustun, qolgani meros', eff.noticeDeadline === '06:30' && eff.dailyLimit === 3 && eff.paymentPerLesson === 40000 && eff.offerTimeoutMinutes === 30)
  extra('akademiya sozlamasi maktab filialiga ta\'sir qilmaydi', (putOverride(orgScope('academy'), validateOverride({ dailyLimit: 5 })), effectiveSettings(branch).dailyLimit === 3))

  // 2-ssenariy (seshanba, Ustoz 2 kelmaydi): umumiy chegara 2 da 4-para "topilmadi" edi; filial chegarasi 3 bo'lsa — Ustoz 1 ga taklif
  const TUE = dateFor(2)
  clock.now = () => tashkent(TUE, '06:00')
  createAbsence(T2, { date: TUE, reason: 'Test', lessonIds: lessonsOn(T2, TUE).map((l) => l.id) })
  const p4 = (db().prepare('SELECT * FROM cases').all() as unknown as CaseRow[]).find((c) => JSON.parse(c.lesson_json).para === 4)!
  extra('kunlik chegara filial bo\'yicha (3): 4-para uchun ham nomzod bor', p4.status === 'pending')

  // Kech xabar: filialda 06:30 — 07:00 da yuborilgan ariza "kech"
  const WED = dateFor(3)
  clock.now = () => tashkent(WED, '07:00')
  createAbsence(T1, { date: WED, reason: 'Test', lessonIds: lessonsOn(T1, WED).map((l) => l.id) })
  const late = (db().prepare('SELECT late FROM absences WHERE teacher_id = ? AND date = ?').get(T1, WED) as { late: number }).late
  extra("xabar berish muddati filial bo'yicha (06:30): 07:00 — kech", late === 1)

  // Taklif muddati filial bo'yicha
  putOverride(branchScope(branch), validateOverride({ noticeDeadline: '06:30', paymentPerLesson: 40000, offerTimeoutMinutes: 10 }))
  const o = db().prepare("SELECT * FROM offers WHERE status = 'pending'").get() as unknown as OfferRow
  extra("taklif muddati filial bo'yicha (10 daqiqa)", offerDto(o).expiresAt === new Date(Date.parse(o.created_at) + 10 * 60_000).toISOString())

  // Yakshanba: filial ish kunlariga 7 qo'shilsa — yakshanbaga ariza berish mumkin
  const SUN = dateFor(7)
  clock.now = () => tashkent(SUN, '06:00')
  let sundayMsg = ''
  try {
    createAbsence(T1, { date: SUN, reason: 'Test', lessonIds: ['x'] })
  } catch (e) {
    sundayMsg = (e as Error).message
  }
  extra('yakshanba dam olish kuni bo\'lsa — ariza rad etiladi', sundayMsg.includes('dam olish'), sundayMsg)
  putOverride(branchScope(branch), validateOverride({ workDays: [1, 2, 3, 4, 5, 6, 7] }))
  let sundayMsg2 = ''
  try {
    createAbsence(T1, { date: SUN, reason: 'Test', lessonIds: ['x'] })
  } catch (e) {
    sundayMsg2 = (e as Error).message
  }
  extra("yakshanba ish kuni bo'lsa — dam olish xatosi yo'q (faqat darsi yo'q)", !sundayMsg2.includes('dam olish') && sundayMsg2.includes('darslar'), sundayMsg2)

  // Merosga qaytarish va noto'g'ri qiymatlar
  putOverride(branchScope(branch), {})
  extra("bo'sh qayta belgilash — merosga qaytadi", effectiveSettings(branch).noticeDeadline === '08:00' && effectiveSettings(branch).paymentPerLesson === 0)
  const bad = (v: Record<string, unknown>) => {
    try {
      validateOverride(v)
      return ''
    } catch (e) {
      return (e as Error).message
    }
  }
  extra("noto'g'ri qiymatlar rad etiladi", Boolean(bad({ dailyLimit: 0 })) && Boolean(bad({ workDays: [] })) && Boolean(bad({ workDays: [8] })) && Boolean(bad({ noticeDeadline: '25:00' })))
  extra("noma'lum maydon (allowCrossBranch) filialda e'tiborsiz", !('allowCrossBranch' in validateOverride({ allowCrossBranch: true })))
  putOverride(branchScope(branch), validateOverride({ paymentPerLesson: 50000 }))
  db().prepare("UPDATE cases SET status = 'found', chosen_teacher_id = ? WHERE id = ?").run(T1, p4.id) // Ustoz 1 bir darsga tayinlangan
  const t1row = monthlyReport(TUE.slice(0, 7)).find((r) => r.teacherId === T1)!
  extra("oylik hisobotda haq filial bo'yicha: 1 dars x 50 000", t1row.substitutedLessons === 1 && t1row.payment === 50000, JSON.stringify(t1row))
}

// ---------- Qo'shimcha: taklif hammaga birdaniga + dars yaqin bo'lsa qisqa muddat ----------
console.log("\nQo'shimcha: tezkor taklif (hammaga birdaniga, darsga moslashgan muddat)")
{
  const setup = async (batch: number) => {
    openDb(':memory:')
    await seedFromWorkbook(wb, 'test123')
    const branch = (db().prepare('SELECT id FROM branches').get() as { id: string }).id
    // Darsi yo'q, Fizika o'ta oladigan 4 ta qo'shimcha ustoz
    for (let i = 1; i <= 4; i++) {
      db()
        .prepare(
          `INSERT INTO teachers (id, full_name, login, password_hash, status, registered_at, phone, subjects, branch_id)
           VALUES (?, ?, ?, 'x', 'active', '2026-11-01', '', '["Fizika"]', ?)`,
        )
        .run(`tx${i}`, `Zaxira Ustoz ${i}`, `zaxira${i}`, branch)
    }
    putSettings({ ...getSettings(), offerBatchSize: batch })
    return (db().prepare("SELECT id FROM teachers WHERE full_name = 'Test Ustoz 2'").get() as { id: string }).id
  }
  const TUE = dateFor(2) // seshanba: Ustoz 2 ning 1-parasi 08:30 Fizika
  const openP1 = (t2: string, time: string) => {
    clock.now = () => tashkent(TUE, time)
    createAbsence(t2, { date: TUE, reason: 'Test', lessonIds: lessonsOn(t2, TUE).filter((l) => l.para === 1).map((l) => l.id) })
    return db().prepare('SELECT * FROM offers ORDER BY rank').all() as unknown as OfferRow[]
  }

  let offers = openP1(await setup(0), '06:00')
  extra('standart: taklif 5 ta mos ustozning hammasiga birdaniga', offers.length === 5, `${offers.length} ta`)
  offers = openP1(await setup(2), '06:00')
  extra('sozlamada "navbat bilan 2 tadan" — 2 ta', offers.length === 2, `${offers.length} ta`)

  offers = openP1(await setup(0), '08:00')
  const dl = offerDeadline(offers[0])!
  extra('dars 08:30, ariza 08:00 -> muddat 08:20 (30 daqiqa emas)', localNow(dl).time === '08:20', localNow(dl).time)
  offers = openP1(await setup(0), '06:00')
  extra('dars uzoq bo\'lsa -> odatdagi 30 daqiqa (06:30)', localNow(offerDeadline(offers[0])!).time === '06:30')
  offers = openP1(await setup(0), '08:22')
  extra('dars juda yaqin (08:22) -> kamida 5 daqiqa (08:27)', localNow(offerDeadline(offers[0])!).time === '08:27')
}

// ---------- Qo'shimcha: bot ichida ro'yxatdan o'tish ----------
console.log("\nQo'shimcha: bot ichida ro'yxatdan o'tish")
{
  openDb(':memory:')
  await seedFromWorkbook(wb, 'test123')
  config.botToken = '123456:TEST' // initData imzosi uchun
  const initData = (id: number, first = 'Aziza') => {
    const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: first }) })
    const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n')
    const secret = createHmac('sha256', 'WebAppData').update(config.botToken).digest()
    p.set('hash', createHmac('sha256', secret).update(check).digest('hex'))
    return p.toString()
  }
  const events: string[] = []
  setNotifier({ teacherRegistered: (id) => events.push(`reg:${id}`), teacherDecided: (id, s) => events.push(`${s}:${id}`), registrationRequested: (tg) => events.push(`chat:${tg}`) })
  const branch = (db().prepare('SELECT id FROM branches').get() as { id: string }).id
  const expectErr = async (fn: () => Promise<unknown>, re: RegExp) => {
    try {
      await fn()
      return false
    } catch (e) {
      return re.test((e as Error).message)
    }
  }

  extra('login: ism + oxirgi 4 raqam', makeLogin('Aziza Karimova', '+998 90 123 45 67') === 'aziza4567')
  extra("login: kirill va apostrof", loginBase('Ғайрат Тошматов') === 'gayrat' && loginBase("O'g'iloy") === 'ogiloy')
  extra('telefon formati', formatPhone('998901234567') === '+998 90 123 45 67')
  extra('soxta initData rad etiladi', await expectErr(async () => tgStatus('user=1&hash=x'), /tasdiqlanmadi/))
  requestChatRegistration(initData(111))
  extra("Mini App ochilsa — ro'yxat bot chatida boshlanadi", events.includes('chat:111'))

  saveContact(111, '+998901234567')
  extra('holat: raqam ko\'rinadi, Telegram ismi taklif qilinadi', (() => { const s = tgStatus(initData(111)); return s.status === 'none' && s.phone === '+998 90 123 45 67' && s.suggestedName === 'Aziza' })())
  const r1 = await registerTelegramUser({ telegramId: 111, fullName: 'Aziza  Karimova', phone: '+998 90 123 45 67', phoneVerified: true, branchId: branch, subjects: ['Fizika', 'Fizika'] })
  const t1 = db().prepare('SELECT * FROM teachers WHERE telegram_id = 111').get() as { id: string; status: string; login: string; password_pending: number; subjects: string }
  extra('yangi xodim: pending, login aziza4567, parol hali yo\'q', r1.status === 'pending' && t1.login === 'aziza4567' && t1.password_pending === 1 && t1.subjects === '["Fizika"]')
  extra('direktorga xabar ketdi', events.includes(`reg:${t1.id}`))
  extra('kutilayotganda holat pending', tgStatus(initData(111)).status === 'pending')

  // Xuddi shu oxirgi 4 raqamli boshqa Aziza
  saveContact(222, '+998 93 777 45 67')
  await registerTelegramUser({ telegramId: 222, fullName: 'Aziza Rahimova', phone: '+998 93 777 45 67', phoneVerified: true, branchId: branch, subjects: ['Fizika'] })
  extra('login band bo\'lsa — aziza4567_2', (db().prepare('SELECT login FROM teachers WHERE telegram_id = 222').get() as { login: string }).login === 'aziza4567_2')

  decideTeacher(t1.id, 'active')
  extra('tasdiqlandi -> xodimga xabar', events.includes(`active:${t1.id}`))
  const pass = await issuePassword(t1.id)
  extra('parol 6 xonali va endi kutilmaydi', /^\d{6}$/.test(pass) && (db().prepare('SELECT password_pending p FROM teachers WHERE id = ?').get(t1.id) as { p: number }).p === 0)
  extra('tasdiqlangan qayta ro\'yxatdan o\'tolmaydi', await expectErr(() => registerTelegramUser({ telegramId: 111, fullName: 'Aziza Karimova', phone: '+998 90 123 45 67', phoneVerified: true, branchId: branch, subjects: ['Fizika'] }), /allaqachon/) && (await expectErr(async () => requestChatRegistration(initData(111)), /allaqachon/)))

  // Davomatdan import qilingan (telefoni bor, Telegram'siz) faol xodim — raqam bo'yicha bog'lanadi
  db().prepare("UPDATE teachers SET phone = '+998 94 555 66 77' WHERE full_name = 'Test Ustoz 3'").run()
  saveContact(333, '998945556677')
  const before = (db().prepare('SELECT COUNT(*) n FROM teachers').get() as { n: number }).n
  const r3 = await registerTelegramUser({ telegramId: 333, fullName: 'Test Ustoz Uch', phone: '998945556677', phoneVerified: true, branchId: branch, subjects: ['Fizika'] })
  const after = (db().prepare('SELECT COUNT(*) n FROM teachers').get() as { n: number }).n
  const u3 = db().prepare("SELECT telegram_id, full_name FROM teachers WHERE phone = '+998 94 555 66 77'").get() as { telegram_id: number; full_name: string }
  extra('mavjud xodim raqam bo\'yicha bog\'landi, darhol kiradi, dublikat yo\'q', r3.status === 'active' && Boolean(r3.token) && after === before && u3.telegram_id === 333 && u3.full_name === 'Test Ustoz 3')

  const ks = branchSubjects(branch)
  extra('fanlar: standart ro\'yxat + jadval', ks.kind === 'subject' && ks.items.includes('Fizika') && ks.items.includes('Kimyo') && ks.items[0] === "Boshlang'ich sinf")

  // Yangi qoidalar
  extra('faqat ism yozilsa — familiya so\'raladi', nameError('Asadbek')?.startsWith('Familiyangizni ham yozing') === true && nameError('Asadbek Karimov') === null)
  extra('telefon: turli yozilishlar', parsePhone('90 123-45-67') === '+998 90 123 45 67' && parsePhone('+998901234567') === '+998 90 123 45 67' && parsePhone('12345') === null)
  extra("ro'yxatda yo'q fan rad etiladi", await expectErr(() => registerTelegramUser({ telegramId: 444, fullName: 'Ali Valiyev', phone: '+998 99 111 22 33', phoneVerified: false, branchId: branch, subjects: ['fizika matem'] }), /ro'yxatdan tanlang/))
  const r4 = await registerTelegramUser({ telegramId: 444, fullName: 'Ali Valiyev', phone: '99 111 22 33', phoneVerified: false, branchId: branch, subjects: ['Kimyo'] })
  extra('qo\'lda yozilgan raqam bilan ham ro\'yxat (pending)', r4.status === 'pending' && r4.login === 'ali2233')
  db().prepare("UPDATE teachers SET phone = '+998 95 000 11 22' WHERE full_name = 'Test Ustoz 4'").run()
  extra("qo'lda yozilgan raqam bazadagi xodimniki — faqat «Raqamni ulashish» bilan", await expectErr(() => registerTelegramUser({ telegramId: 555, fullName: 'Begona Odam', phone: '+998 95 000 11 22', phoneVerified: false, branchId: branch, subjects: ['Kimyo'] }), /Raqamni ulashish/))
  extra('...va bog\'lanmadi', (db().prepare("SELECT telegram_id t FROM teachers WHERE full_name = 'Test Ustoz 4'").get() as { t: number | null }).t === null)

  // Lavozim: mas'ul shaxs — direktor tasdiqlagach o'rinbosarni tasdiqlay oladi
  await registerTelegramUser({ telegramId: 666, fullName: 'Mas\'ul Odam', phone: '+998 97 600 60 60', phoneVerified: true, branchId: branch, subjects: ['Fizika'], coordinator: true })
  const coord = db().prepare('SELECT is_coordinator c, status s FROM teachers WHERE telegram_id = 666').get() as { c: number; s: string }
  extra("lavozim \"Mas'ul shaxs\" — is_coordinator, lekin tasdiqgacha pending", coord.c === 1 && coord.s === 'pending')

  // Lavozim: filial direktori — umumiy rahbariyat tasdiqlaydi
  const dirEvents: { approved: boolean; creds?: { login: string; password: string } }[] = []
  setNotifier({ directorDecided: (_id, approved, creds) => dirEvents.push({ approved, creds }) })
  requestDirector({ telegramId: 777, fullName: 'Asadbek Oybekov', phone: '+998 95 256 07 10', branchId: branch })
  requestDirector({ telegramId: 777, fullName: 'Asadbek Oybekov', phone: '+998 95 256 07 10', branchId: branch }) // qayta — yangilanadi
  const reqs = listDirectorRequests()
  extra('direktorlik arizasi panel ro\'yxatida (bitta)', reqs.length === 1 && reqs[0].fullName === 'Asadbek Oybekov')
  await decideDirectorRequest(reqs[0].id, true)
  const dir = db().prepare('SELECT * FROM directors WHERE branch_id = ?').get(branch) as { full_name: string; telegram_id: number; login: string }
  extra('tasdiqlandi: filial direktori shu odam, Telegram ulangan', dir.full_name === 'Asadbek Oybekov' && dir.telegram_id === 777 && listDirectorRequests().length === 0)
  extra("login va 6 xonali parol botga ketdi", dirEvents[0]?.approved === true && dirEvents[0].creds?.login === dir.login && /^\d{6}$/.test(dirEvents[0].creds?.password ?? ''))
  extra('qayta tasdiqlab bo\'lmaydi', await expectErr(() => decideDirectorRequest(reqs[0].id, true), /ko'rib chiqilgan/))
  requestDirector({ telegramId: 888, fullName: 'Begona Odam', phone: '+998 90 888 88 88', branchId: branch })
  await decideDirectorRequest(listDirectorRequests()[0].id, false)
  extra('rad etilsa direktor o\'zgarmaydi', (db().prepare('SELECT telegram_id t FROM directors WHERE branch_id = ?').get(branch) as { t: number }).t === 777 && dirEvents[1]?.approved === false)
}

console.log(`\n${passed} ta to'g'ri, ${failed} ta xato (jami ${passed + failed})`)
process.exit(failed === 0 ? 0 : 1)
