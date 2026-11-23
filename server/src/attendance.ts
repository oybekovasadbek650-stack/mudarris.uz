// 2-bosqich: davomat bo'yicha "kelmadi" signali.
//
// Avtomatik ariza OCHILMAYDI (kamera yuzni tanimasligi, boshqa eshikdan kirish mumkin) — qarorni odam qiladi:
//  1) Birinchi darsdan `attendanceAskMinutes` oldin davomatda kirish yo'q -> bot ustozdan so'raydi
//     ("Kelyapman" / "Kela olmayman"). "Kela olmayman" -> ariza ochiladi, o'rinbosar qidiriladi.
//  2) `attendanceEscalateMinutes` ichida javob yo'q (yoki Telegram ulanmagan) -> direktor va mas'ulga xabar,
//     ular "O'rinbosar qidirish" tugmasi bilan arizani ochadi (panelda ham shu tugma bor).
//  3) Davomatda kirish paydo bo'lsa — tekshiruv to'xtaydi.
// Faqat davomatga bog'langan (davomat_code bor) va shu kuni darsi bor ustozlar tekshiriladi.
import { db } from './db.ts'
import { davomatCheckedIn, davomatEmployeeId, davomatEnabled } from './davomat.ts'
import { approverLabelForBranch, createAbsence, type Actor } from './logic.ts'
import { fail, getTeacher, lessonsOn, type TeacherRow } from './repo.ts'
import { anyBranchHas, effectiveSettings } from './settings.ts'
import { notify } from './notify.ts'
import { clock, localNow, weekdayOf } from './time.ts'
import type { AttendanceMissing, Lesson, Settings } from '../../src/types.ts'

type Stage = 'asked' | 'coming' | 'present' | 'escalated' | 'absence_created'
interface CheckRow {
  teacher_id: string
  date: string
  stage: Stage
  reason: string | null
  asked_at: string | null
  escalated_at: string | null
}

const minutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))
/** Darsdan keyin shuncha vaqt o'tgach tekshiruv boshlanmaydi (kech ishga tushgan server eski kunni bezovta qilmasin) */
const LATE_LIMIT_MIN = 60

const getRow = (teacherId: string, date: string) =>
  db().prepare('SELECT * FROM attendance_checks WHERE teacher_id = ? AND date = ?').get(teacherId, date) as unknown as CheckRow | undefined

function setStage(teacherId: string, date: string, stage: Stage, extra: { reason?: string; asked?: boolean; escalated?: boolean } = {}) {
  const now = clock.now().toISOString()
  db()
    .prepare(
      `INSERT INTO attendance_checks (teacher_id, date, stage, reason, asked_at, escalated_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(teacher_id, date) DO UPDATE SET
         stage = ?3,
         reason = COALESCE(?4, reason),
         asked_at = COALESCE(?5, asked_at),
         escalated_at = COALESCE(?6, escalated_at),
         updated_at = ?7`,
    )
    .run(teacherId, date, stage, extra.reason ?? null, extra.asked ? now : null, extra.escalated ? now : null, now)
}

const hasAbsence = (teacherId: string, date: string) =>
  Boolean(db().prepare('SELECT 1 FROM absences WHERE teacher_id = ? AND date = ?').get(teacherId, date))

/** Bugungi hali tugamagan darslar (kelajak kun bo'lsa — hammasi) */
function remainingLessons(teacherId: string, date: string): Lesson[] {
  const { date: today, time } = localNow()
  const all = lessonsOn(teacherId, date)
  return date > today ? all : all.filter((l) => l.endTime > time)
}

export interface SweepResult {
  asked: string[]
  escalated: string[]
  present: string[]
  skipped?: string
}

/**
 * Har daqiqada chaqiriladi (index.ts). checkedIn — testlar uchun almashtirsa bo'ladi (standart: davomat API).
 */
export async function attendanceSweep(checkedIn: (date: string) => Promise<Set<string>> = davomatCheckedIn): Promise<SweepResult> {
  const res: SweepResult = { asked: [], escalated: [], present: [] }
  const { date, time } = localNow()
  const weekday = weekdayOf(date)
  const now = minutes(time)

  // Har ustoz o'z filiali sozlamasi bo'yicha: yoqilganmi, ish kunimi, qachon so'rash/xabar berish
  const all = (
    db().prepare("SELECT * FROM teachers WHERE status = 'active' AND davomat_code IS NOT NULL").all() as unknown as TeacherRow[]
  ).map((t) => ({ t, s: effectiveSettings(t.branch_id) }))
  const enabled = all.filter((x) => x.s.attendanceCheck)
  if (enabled.length === 0) return { ...res, skipped: "sozlamada o'chiq" }
  const teachers = enabled.filter((x) => x.s.workDays.includes(weekday))
  if (teachers.length === 0) return { ...res, skipped: 'dam olish kuni' }

  // Shu daqiqada qaror kerak bo'lgan ustozlar
  const due: { t: TeacherRow; s: Settings; row?: CheckRow }[] = []
  for (const { t, s } of teachers) {
    if (hasAbsence(t.id, date)) continue
    const row = getRow(t.id, date)
    if (row && row.stage !== 'asked') continue // coming / present / escalated / absence_created — tugagan
    const first = lessonsOn(t.id, date)[0]
    if (!first) continue
    const start = minutes(first.startTime)
    if (!row && (now < start - s.attendanceAskMinutes || now > start + LATE_LIMIT_MIN)) continue
    due.push({ t, s, row })
  }
  if (due.length === 0) return res

  const present = await checkedIn(date) // davomat ishlamasa — xato yuqoriga chiqadi, hech narsa o'zgarmaydi
  const nowIso = clock.now().getTime()

  for (const { t, s, row } of due) {
    if (present.has(davomatEmployeeId(t.davomat_code!))) {
      setStage(t.id, date, 'present')
      res.present.push(t.id)
      continue
    }
    if (!row) {
      if (t.telegram_id != null) {
        setStage(t.id, date, 'asked', { asked: true })
        notify.attendanceAsk(t.id, date)
        res.asked.push(t.id)
      } else {
        setStage(t.id, date, 'escalated', { reason: 'no_telegram', escalated: true })
        notify.attendanceEscalate(t.id, date, 'no_telegram')
        res.escalated.push(t.id)
      }
    } else if (row.asked_at && nowIso - Date.parse(row.asked_at) >= s.attendanceEscalateMinutes * 60_000) {
      setStage(t.id, date, 'escalated', { reason: 'no_answer', escalated: true })
      notify.attendanceEscalate(t.id, date, 'no_answer')
      res.escalated.push(t.id)
    }
  }
  return res
}

/** Ustoz botdagi savolga javob berdi */
export function teacherAttendanceReply(teacherId: string, date: string, coming: boolean) {
  if (hasAbsence(teacherId, date)) fail(409, 'Bu kun uchun ariza allaqachon ochilgan')
  const before = getRow(teacherId, date)
  if (coming) {
    setStage(teacherId, date, 'coming')
    if (before?.stage === 'escalated') notify.attendanceComing(teacherId, date)
    return { stage: 'coming' as const }
  }
  const lessons = remainingLessons(teacherId, date)
  if (lessons.length === 0) fail(400, "Bu kunda qolgan darsingiz yo'q")
  const r = createAbsence(teacherId, { date, reason: "Telegram orqali: bugun kela olmayman", lessonIds: lessons.map((l) => l.id) })
  setStage(teacherId, date, 'absence_created')
  return { stage: 'absence_created' as const, casesCount: r.casesCount }
}

/** Direktor / mas'ul / rahbariyat kelmagan ustoz uchun arizani o'zi ochadi */
export function openAbsenceForMissing(actor: Actor, teacherId: string, date: string) {
  const t = getTeacher(teacherId)
  if (t.status !== 'active') fail(400, "O'qituvchi faol emas")
  const label = approverLabelForBranch(actor, t.branchId)
  if (hasAbsence(teacherId, date)) fail(409, `${t.fullName} uchun bu kunga ariza allaqachon ochilgan`)
  const lessons = remainingLessons(teacherId, date)
  if (lessons.length === 0) fail(400, `${t.fullName}ning bu kunda qolgan darsi yo'q`)
  const r = createAbsence(teacherId, {
    date,
    reason: `Kelmadi (davomatda kirish yo'q). Arizani ochdi — ${label}`,
    lessonIds: lessons.map((l) => l.id),
  })
  setStage(teacherId, date, 'absence_created')
  return { casesCount: r.casesCount, fullName: t.fullName }
}

/** Panel uchun: shu kuni davomat bo'yicha hali kelmagan (so'ralgan / xabar berilgan) ustozlar */
export function attendanceMissing(date: string, scopeBranchId?: string): AttendanceMissing[] {
  const rows = db()
    .prepare("SELECT * FROM attendance_checks WHERE date = ? AND stage IN ('asked', 'escalated')")
    .all(date) as unknown as CheckRow[]
  return rows
    .filter((r) => !hasAbsence(r.teacher_id, date))
    .map((r) => {
      const t = getTeacher(r.teacher_id)
      const first = lessonsOn(t.id, date)[0]
      return {
        teacherId: t.id,
        fullName: t.fullName,
        branchId: t.branchId,
        date,
        firstLesson: first
          ? { para: first.para, startTime: first.startTime, className: first.className, subject: first.subject }
          : { para: 0, startTime: '', className: '', subject: '' },
        stage: r.stage as 'asked' | 'escalated',
        reason: (r.reason as AttendanceMissing['reason']) ?? undefined,
      }
    })
    .filter((m) => !scopeBranchId || m.branchId === scopeBranchId)
    .sort((a, b) => a.firstLesson.startTime.localeCompare(b.firstLesson.startTime))
}

/** Davomat signali ishlaydimi (direktor uchun — o'z filialida, rahbariyat uchun — biror filialda) */
export const attendanceAvailable = (branchId?: string) => davomatEnabled() && anyBranchHas((s) => s.attendanceCheck, branchId)
