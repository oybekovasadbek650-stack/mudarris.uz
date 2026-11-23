// Asosiy mantiq: "Kela olmayman" arizasi -> holatlar -> o'rinbosar nomzodlari -> takliflar.
//
// Ustoz o'rinbosar NOMZODI bo'ladi, agar:
//  1) faol bo'lsa, kelmaydigan ustozning o'zi emas va o'sha kuni o'zi ham kelmayotgan bo'lmasa;
//  2) filiali bir xil bo'lsa (yoki sozlamada boshqa filialga ruxsat bo'lsa);
//  3) bu fanni o'ta olsa (asosiy yoki qo'shimcha fani);
//  4) o'sha kuni o'sha parada o'z darsi ham, boshqa o'rinbosarlik majburiyati ham bo'lmasa;
//  5) o'sha kungi o'rinbosarlik majburiyatlari soni kunlik chegaradan kam bo'lsa.
// "Majburiyat" = o'sha kungi boshqa holat bo'yicha javob kutayotgan/qabul qilingan taklifi
// yoki u tanlangan holat. Shunday qilib bitta ustozga chegaradan ortiq taklif bormaydi.
//
// Saralash: avval asosiy fani mos keladiganlar, keyin bu oy kamroq o'rinbosar bo'lganlar.
// Taklif standart holatda HAMMA mos nomzodga birdaniga yuboriladi (settings.offerBatchSize = 0);
// sozlamada N berilsa — navbat bilan N tadan.
// Kimdir rad etsa — navbatdagi nomzodga yangi taklif. Hech kim qolmasa — "topilmadi".
import { db, newId, tx } from './db.ts'
import { clock, isISODate, localNow, tashkent, weekdayOf } from './time.ts'
import {
  activeTeachers,
  directorRow,
  fail,
  getSettings,
  getTeacher,
  lessonsOn,
  teacherRow,
  type AbsenceRow,
  type CaseRow,
  type OfferRow,
} from './repo.ts'
import { notify } from './notify.ts'
import { effectiveSettings } from './settings.ts'
import type { Candidate, CoverCase, Lesson, MonthlyReportRow, Offer, Role, Teacher } from '../../src/types.ts'

const canTeach = (t: Teacher, subject: string) => t.subjects.includes(subject) || (t.extraSubjects ?? []).includes(subject)

// ---------- O'qish yordamchilari ----------

export const caseRow = (id: string) => db().prepare('SELECT * FROM cases WHERE id = ?').get(id) as unknown as CaseRow | undefined
export const offerRow = (id: string) => db().prepare('SELECT * FROM offers WHERE id = ?').get(id) as unknown as OfferRow | undefined
export const absenceRow = (id: string) =>
  db().prepare('SELECT * FROM absences WHERE id = ?').get(id) as unknown as AbsenceRow | undefined
const lessonOf = (c: CaseRow) => JSON.parse(c.lesson_json) as Lesson
const offersOfCase = (caseId: string) =>
  db().prepare('SELECT * FROM offers WHERE case_id = ? ORDER BY rank').all(caseId) as unknown as OfferRow[]

/** Ustozning shu kundagi o'rinbosarlik majburiyatlari (berilgan holatdan tashqari) */
function commitments(teacherId: string, date: string, exceptCaseId?: string): Lesson[] {
  const rows = db()
    .prepare(
      `SELECT DISTINCT c.* FROM cases c
       LEFT JOIN offers o ON o.case_id = c.id AND o.teacher_id = ?1
       WHERE c.date = ?2 AND c.id != ?3 AND (
         c.chosen_teacher_id = ?1 OR
         (c.status = 'pending' AND o.status IN ('pending', 'accepted'))
       )`,
    )
    .all(teacherId, date, exceptCaseId ?? '') as unknown as CaseRow[]
  return rows.map(lessonOf)
}

const substitutionsInMonth = (teacherId: string, month: string) =>
  (
    db()
      .prepare("SELECT COUNT(*) n FROM cases WHERE chosen_teacher_id = ? AND status = 'found' AND date LIKE ?")
      .get(teacherId, `${month}%`) as { n: number }
  ).n

const absentTeacherIds = (date: string) =>
  new Set((db().prepare('SELECT teacher_id FROM absences WHERE date = ?').all(date) as { teacher_id: string }[]).map((r) => r.teacher_id))

/** Shu holat uchun hozir taklif yuborsa bo'ladigan ustozlar, saralangan holda */
export function rankCandidates(c: CaseRow): Teacher[] {
  const lesson = lessonOf(c)
  const settings = getSettings() // allowCrossBranch — faqat umumiy
  const limitOf = (branchId: string) => effectiveSettings(branchId).dailyLimit // kunlik chegara — ustozning o'z filiali bo'yicha
  const absent = absentTeacherIds(c.date)
  const alreadyOffered = new Set(offersOfCase(c.id).map((o) => o.teacher_id))
  const month = c.date.slice(0, 7)

  return activeTeachers()
    .filter((t) => {
      if (t.id === lesson.teacherId || absent.has(t.id) || alreadyOffered.has(t.id)) return false
      if (!settings.allowCrossBranch && t.branchId !== lesson.branchId) return false
      if (!canTeach(t, lesson.subject)) return false
      if (lessonsOn(t.id, c.date).some((l) => l.para === lesson.para)) return false
      const busy = commitments(t.id, c.date, c.id)
      if (busy.some((l) => l.para === lesson.para)) return false
      return busy.length < limitOf(t.branchId)
    })
    .map((t) => ({ t, primary: t.subjects.includes(lesson.subject) ? 0 : 1, subs: substitutionsInMonth(t.id, month) }))
    .sort((a, b) => a.primary - b.primary || a.subs - b.subs || a.t.fullName.localeCompare(b.t.fullName))
    .map((x) => x.t)
}

/**
 * Holatda javob kutilayotgan/qabul qilingan takliflar N tadan kam bo'lsa — navbatdagi nomzodlarga taklif yuboradi.
 * Hech qanday faol taklif qolmasa — holat "topilmadi".
 * Yangi yaratilgan takliflar id'larini qaytaradi.
 */
function fillOffers(caseId: string): { created: string[]; notFound: boolean } {
  const c = caseRow(caseId)!
  if (c.status !== 'pending') return { created: [], notFound: false }
  const existing = offersOfCase(caseId)
  const active = existing.filter((o) => o.status === 'pending' || o.status === 'accepted').length
  // 0 = hamma mos ustozga birdaniga (kim birinchi rozi bo'lsa — darhol tasdiqlashga); aks holda navbat bilan N tadan
  const batch = effectiveSettings(lessonOf(c).branchId).offerBatchSize
  const need = batch === 0 ? Number.POSITIVE_INFINITY : Math.max(0, batch - active)
  const created: string[] = []
  if (need > 0) {
    let rank = existing.reduce((m, o) => Math.max(m, o.rank), 0)
    const ins = db().prepare('INSERT INTO offers (id, case_id, teacher_id, rank, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    for (const t of rankCandidates(c).slice(0, need)) {
      const id = newId('o')
      ins.run(id, caseId, t.id, ++rank, 'pending', clock.now().toISOString())
      created.push(id)
    }
  }
  if (active + created.length === 0) {
    db().prepare("UPDATE cases SET status = 'not_found' WHERE id = ?").run(caseId)
    return { created, notFound: true }
  }
  return { created, notFound: false }
}

// ---------- Amallar ----------

export interface NewAbsenceInput {
  date: string
  reason: string
  lessonIds: string[]
}

/** O'qituvchi "Kela olmayman" arizasini yuboradi */
export function createAbsence(teacherId: string, input: NewAbsenceInput) {
  const { date, time } = localNow()
  if (!isISODate(input.date)) fail(400, "Sana noto'g'ri")
  if (input.date < date) fail(400, "O'tgan sana uchun ariza yuborib bo'lmaydi")
  const settings = effectiveSettings(getTeacher(teacherId).branchId)
  if (!settings.workDays.includes(weekdayOf(input.date))) fail(400, "Bu kun filialingizda dam olish kuni")
  const reason = String(input.reason ?? '').trim()
  if (!reason) fail(400, 'Sababni yozing')
  if (reason.length > 500) fail(400, 'Sabab juda uzun')
  if (!Array.isArray(input.lessonIds) || input.lessonIds.length === 0) fail(400, 'Kamida bitta darsni tanlang')
  if (db().prepare('SELECT 1 FROM absences WHERE teacher_id = ? AND date = ?').get(teacherId, input.date)) {
    fail(409, 'Bu sana uchun ariza allaqachon yuborilgan')
  }
  const lessons = lessonsOn(teacherId, input.date).filter((l) => input.lessonIds.includes(l.id))
  if (lessons.length === 0) fail(400, "Tanlangan darslar bu kunda sizning jadvalingizda yo'q")

  // Xabar berish muddati: o'sha kuni soat noticeDeadline gacha. Kech bo'lsa ham qabul qilinadi, lekin belgilanadi.
  const late = input.date === date && time > settings.noticeDeadline

  const result = tx(() => {
    const absenceId = newId('a')
    db()
      .prepare('INSERT INTO absences (id, teacher_id, date, reason, created_at, late) VALUES (?, ?, ?, ?, ?, ?)')
      .run(absenceId, teacherId, input.date, reason, clock.now().toISOString(), late ? 1 : 0)
    const insCase = db().prepare("INSERT INTO cases (id, absence_id, date, lesson_json, status) VALUES (?, ?, ?, ?, 'pending')")
    const caseIds = lessons.map((l) => {
      const id = newId('c')
      insCase.run(id, absenceId, input.date, JSON.stringify(l))
      return id
    })
    // Para tartibida: oldingi parada taklif olgan ustoz kunlik chegarasi to'g'ri hisoblanadi
    const offers: string[] = []
    const notFound: string[] = []
    for (const id of caseIds) {
      const r = fillOffers(id)
      offers.push(...r.created)
      if (r.notFound) notFound.push(id)
    }
    return { absenceId, caseIds, offers, notFound }
  })

  notify.absenceCreated(result.absenceId)
  result.offers.forEach((id) => notify.offerCreated(id))
  result.notFound.forEach((id) => notify.caseNotFound(id))
  return { id: result.absenceId, casesCount: result.caseIds.length }
}

// ---------- Javob berish muddati ----------

/** Taklifga javob muddati (daqiqa) — dars filiali sozlamasi bo'yicha */
export function offerTimeoutOf(o: OfferRow): number {
  const c = caseRow(o.case_id)
  return effectiveSettings(c ? lessonOf(c).branchId : undefined).offerTimeoutMinutes
}

/** Taklif shu paytgacha amal qiladi (muddat o'chirilgan bo'lsa — undefined) */
/**
 * Taklif shu paytgacha amal qiladi. Odatda yaratilgandan `offerTimeoutMinutes` keyin, lekin dars yaqin bo'lsa —
 * dars boshlanishidan 10 daqiqa oldin (direktor/mas'ul ulgurishi uchun), kamida 5 daqiqa javob vaqti qoladi.
 */
export function offerDeadline(o: OfferRow): Date | undefined {
  const minutes = offerTimeoutOf(o)
  if (!minutes || minutes <= 0) return undefined
  const created = Date.parse(o.created_at)
  let end = created + minutes * 60_000
  const c = caseRow(o.case_id)
  if (c) {
    const lessonStart = tashkent(c.date, lessonOf(c).startTime).getTime()
    const beforeLesson = lessonStart - 10 * 60_000
    if (beforeLesson < end) end = Math.max(created + 5 * 60_000, beforeLesson)
  }
  return new Date(end)
}

/**
 * Muddatida javob berilmagan takliflarni yopadi ("expired") va o'sha holatlar uchun
 * navbatdagi nomzodlarga yangi taklif yuboradi. Nomzod qolmasa — holat "topilmadi".
 * Muddat har filialda boshqacha bo'lishi mumkin, shuning uchun har taklif alohida tekshiriladi.
 * Server har 30 soniyada chaqiradi (index.ts), javob berishdan oldin ham tekshiriladi.
 */
export function expireStaleOffers(): { expired: string[] } {
  const now = clock.now().getTime()
  const stale = (
    db()
      .prepare(`SELECT o.* FROM offers o JOIN cases c ON c.id = o.case_id WHERE o.status = 'pending' AND c.status = 'pending'`)
      .all() as unknown as OfferRow[]
  ).filter((o) => {
    const d = offerDeadline(o)
    return d !== undefined && d.getTime() <= now
  })
  if (stale.length === 0) return { expired: [] }

  const r = tx(() => {
    const upd = db().prepare("UPDATE offers SET status = 'expired', responded_at = ? WHERE id = ?")
    for (const o of stale) upd.run(clock.now().toISOString(), o.id)
    const created: string[] = []
    const notFound: string[] = []
    for (const caseId of [...new Set(stale.map((o) => o.case_id))]) {
      const f = fillOffers(caseId)
      created.push(...f.created)
      if (f.notFound) notFound.push(caseId)
    }
    return { created, notFound }
  })

  stale.forEach((o) => notify.offerExpired(o.id))
  r.created.forEach((id) => notify.offerCreated(id))
  r.notFound.forEach((id) => notify.caseNotFound(id))
  return { expired: stale.map((o) => o.id) }
}

/** O'qituvchi taklifga javob beradi */
export function respondOffer(teacherId: string, offerId: string, accept: boolean): Offer {
  const o = offerRow(offerId)
  if (!o || o.teacher_id !== teacherId) return fail(404, 'Taklif topilmadi')
  const deadline = offerDeadline(o)
  if (o.status === 'pending' && deadline && clock.now() >= deadline) {
    expireStaleOffers()
    fail(409, `Javob berish muddati (${offerTimeoutOf(o)} daqiqa) o'tib ketdi, taklif yopildi.`)
  }
  if (o.status !== 'pending') fail(409, "Bu taklifga allaqachon javob berilgan yoki muddati o'tgan")
  const c = caseRow(o.case_id)!
  if (c.status !== 'pending') fail(409, "Bu dars uchun o'rinbosar allaqachon hal qilingan")

  const r = tx(() => {
    db()
      .prepare('UPDATE offers SET status = ?, responded_at = ? WHERE id = ?')
      .run(accept ? 'accepted' : 'rejected', clock.now().toISOString(), offerId)
    return accept ? { created: [], notFound: false } : fillOffers(o.case_id)
  })

  if (accept) notify.offerAccepted(offerId)
  r.created.forEach((id) => notify.offerCreated(id))
  if (r.notFound) notify.caseNotFound(o.case_id)
  return offerDto(offerRow(offerId)!)
}

/** Kim harakat qilyapti (token egasi) */
export interface Actor {
  role: Role
  id: string
}

/**
 * Shu holat bo'yicha o'rinbosarni tasdiqlay oladimi? Ha bo'lsa — "kim tasdiqladi" yozuvi.
 * Rahbariyat — hamma filial; direktor — o'z filiali; o'qituvchi — faqat mas'ul bo'lsa va o'z filiali.
 */
export function approverLabel(actor: Actor, c: CaseRow): string {
  return approverLabelForBranch(actor, lessonOf(c).branchId)
}

/** Shu filial bo'yicha qaror qila oladimi (rahbariyat / o'z filiali direktori / o'z filiali mas'uli) */
export function approverLabelForBranch(actor: Actor, branchId: string): string {
  if (actor.role === 'admin') return 'Rahbariyat'
  if (actor.role === 'director') {
    const d = directorRow(actor.id)
    if (!d || d.branch_id !== branchId) fail(403, 'Bu holat boshqa filialga tegishli')
    return `Direktor: ${d!.full_name}`
  }
  const me = getTeacher(actor.id)
  if (!me.isCoordinator) fail(403, "Bu bo'lim faqat mas'ul shaxs uchun")
  if (me.branchId !== branchId) fail(403, 'Bu holat boshqa filialga tegishli')
  return `Mas'ul: ${me.fullName}`
}

/** Direktor, mas'ul yoki rahbariyat taklifni qabul qilgan ustozlardan birini tasdiqlaydi. Birinchi tasdiq yetarli. */
export function chooseCandidate(actor: Actor, caseId: string, teacherId: string): CoverCase {
  const c = caseRow(caseId)
  if (!c) return fail(404, 'Holat topilmadi')
  const label = approverLabel(actor, c)
  if (c.status !== 'pending') {
    const who = c.chosen_by ? ` (${c.chosen_by})` : ''
    fail(409, `Bu dars uchun o'rinbosar allaqachon hal qilingan${who}`)
  }
  const offer = offersOfCase(caseId).find((o) => o.teacher_id === teacherId && o.status === 'accepted')
  if (!offer) fail(400, 'Bu ustoz taklifni qabul qilmagan')

  const expired = tx(() => {
    db().prepare("UPDATE cases SET status = 'found', chosen_teacher_id = ?, chosen_by = ? WHERE id = ?").run(teacherId, label, caseId)
    const others = offersOfCase(caseId).filter((o) => o.id !== offer!.id && (o.status === 'pending' || o.status === 'accepted'))
    db().prepare("UPDATE offers SET status = 'expired' WHERE case_id = ? AND id != ? AND status IN ('pending', 'accepted')").run(caseId, offer!.id)
    return others.map((o) => o.id)
  })
  notify.caseChosen(caseId, expired, actor)
  return caseDto(caseRow(caseId)!)
}

// ---------- JSON shakllari ----------

export function caseDto(c: CaseRow): CoverCase {
  const lesson = lessonOf(c)
  const absence = absenceRow(c.absence_id)!
  const absent = teacherRow(absence.teacher_id)
  const month = c.date.slice(0, 7)
  const candidates: Candidate[] = offersOfCase(c.id)
    .filter((o) => o.status === 'accepted' || (c.status === 'found' && o.teacher_id === c.chosen_teacher_id))
    .map((o) => {
      const t = getTeacher(o.teacher_id)
      return {
        teacherId: t.id,
        fullName: t.fullName,
        subjects: [...t.subjects, ...(t.extraSubjects ?? [])],
        sameSubject: t.subjects.includes(lesson.subject),
        lessonsThatDay: lessonsOn(t.id, c.date).length,
        substitutionsThisMonth: substitutionsInMonth(t.id, month),
      }
    })
  const chosen = c.chosen_teacher_id ? teacherRow(c.chosen_teacher_id) : undefined
  return {
    id: c.id,
    absenceId: c.absence_id,
    date: c.date,
    lesson,
    absentTeacher: { id: absence.teacher_id, fullName: absent?.full_name ?? '' },
    reason: absence.reason,
    lateNotice: absence.late === 1,
    status: c.status,
    candidates,
    chosenTeacher: chosen && { id: chosen.id, fullName: chosen.full_name },
    chosenBy: c.chosen_by ?? undefined,
  }
}

export function offerDto(o: OfferRow): Offer {
  const c = caseRow(o.case_id)!
  const absence = absenceRow(c.absence_id)!
  return {
    id: o.id,
    caseId: c.id,
    date: c.date,
    lesson: lessonOf(c),
    absentTeacherName: teacherRow(absence.teacher_id)?.full_name ?? '',
    status: o.status,
    assigned: c.chosen_teacher_id === o.teacher_id,
    expiresAt: o.status === 'pending' ? offerDeadline(o)?.toISOString() : undefined,
  }
}

const byDateAndPara = (a: { date: string; lesson: Lesson }, b: { date: string; lesson: Lesson }) =>
  a.date.localeCompare(b.date) || a.lesson.para - b.lesson.para

export const myOffers = (teacherId: string) =>
  (db().prepare('SELECT * FROM offers WHERE teacher_id = ?').all(teacherId) as unknown as OfferRow[]).map(offerDto).sort(byDateAndPara)

/** Men o'rinbosar bo'lgan darslar: mas'ul meni tanlagan holatlar */
export const mySubstitutions = (teacherId: string) =>
  (
    db()
      .prepare("SELECT o.* FROM offers o JOIN cases c ON c.id = o.case_id WHERE o.teacher_id = ? AND c.chosen_teacher_id = ?")
      .all(teacherId, teacherId) as unknown as OfferRow[]
  )
    .map(offerDto)
    .sort((a, b) => byDateAndPara(b, a))

/** Mas'ulning filialidagi bugungi va kelgusi holatlar */
export function coordinatorCases(teacherId: string): CoverCase[] {
  const me = getTeacher(teacherId)
  if (!me.isCoordinator) fail(403, "Bu bo'lim faqat mas'ul shaxs uchun")
  return (db().prepare('SELECT * FROM cases WHERE date >= ?').all(localNow().date) as unknown as CaseRow[])
    .filter((c) => lessonOf(c).branchId === me.branchId)
    .map(caseDto)
    .sort(byDateAndPara)
}

export function dayOverview(date: string, branchId?: string) {
  const rows = db().prepare('SELECT * FROM absences WHERE date = ? ORDER BY created_at').all(date) as unknown as AbsenceRow[]
  return {
    date,
    absences: rows
      .map((a) => ({ a, teacher: getTeacher(a.teacher_id) }))
      .filter(({ teacher }) => !branchId || teacher.branchId === branchId)
      .map(({ a, teacher }) => ({
        id: a.id,
        teacher,
        reason: a.reason,
        lateNotice: a.late === 1,
        cases: (db().prepare('SELECT * FROM cases WHERE absence_id = ?').all(a.id) as unknown as CaseRow[]).map(caseDto).sort(byDateAndPara),
      })),
  }
}

export function monthlyReport(month: string, branchId?: string) {
  return activeTeachers().filter((t) => !branchId || t.branchId === branchId).map((t) => {
    const { paymentPerLesson } = effectiveSettings(t.branchId) // haq filial bo'yicha
    const absentDays = (
      db().prepare('SELECT COUNT(DISTINCT date) n FROM absences WHERE teacher_id = ? AND date LIKE ?').get(t.id, `${month}%`) as { n: number }
    ).n
    const substitutedLessons = substitutionsInMonth(t.id, month)
    return {
      teacherId: t.id,
      fullName: t.fullName,
      branchId: t.branchId,
      absentDays,
      substitutedLessons,
      payment: substitutedLessons * paymentPerLesson,
    } as MonthlyReportRow
  })
}
