// Bazadagi qatorlarni frontend kutadigan JSON shakliga (src/types.ts) o'tkazish.
import { db } from './db.ts'
import { weekdayOf } from './time.ts'
import type { Branch, Lesson, Me, Org, Role, Settings, Teacher } from '../../src/types.ts'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message)
}

export interface TeacherRow {
  id: string
  full_name: string
  login: string
  password_hash: string
  status: Teacher['status']
  registered_at: string
  phone: string
  subjects: string
  extra_subjects: string
  branch_id: string
  telegram_id: number | null
  is_coordinator: number
  davomat_code: string | null
  password_pending: number
}
export interface LessonRow {
  id: string
  branch_id: string
  weekday: number
  para: number
  start_time: string
  end_time: string
  class_name: string
  subject: string
  room: string
  teacher_id: string
}
export interface AbsenceRow {
  id: string
  teacher_id: string
  date: string
  reason: string
  created_at: string
  late: number
}
export interface CaseRow {
  id: string
  absence_id: string
  date: string
  lesson_json: string
  status: 'pending' | 'found' | 'not_found'
  chosen_teacher_id: string | null
  chosen_by: string | null
}
export interface OfferRow {
  id: string
  case_id: string
  teacher_id: string
  rank: number
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  created_at: string
  responded_at: string | null
}

const parseList = (s: string): string[] => {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

// ---------- Filiallar ----------

export const listBranches = () => db().prepare('SELECT id, name, org FROM branches ORDER BY name').all() as unknown as Branch[]

export function orgOf(branchId: string): Org {
  const r = db().prepare('SELECT org FROM branches WHERE id = ?').get(branchId) as { org: Org } | undefined
  return r?.org ?? 'school'
}

// ---------- O'qituvchilar ----------

export const teacherRow = (id: string) =>
  db().prepare('SELECT * FROM teachers WHERE id = ?').get(id) as unknown as TeacherRow | undefined

export function teacherDto(r: TeacherRow): Teacher {
  return {
    id: r.id,
    fullName: r.full_name,
    login: r.login,
    status: r.status,
    registeredAt: r.registered_at,
    phone: r.phone,
    subjects: parseList(r.subjects),
    extraSubjects: parseList(r.extra_subjects),
    branchId: r.branch_id,
    telegramLinked: r.telegram_id != null,
    isCoordinator: r.is_coordinator === 1,
    davomatCode: r.davomat_code ?? undefined,
  }
}

export const getTeacher = (id: string) => {
  const r = teacherRow(id)
  return r ? teacherDto(r) : fail(404, "O'qituvchi topilmadi")
}

export const activeTeachers = () =>
  (db().prepare("SELECT * FROM teachers WHERE status = 'active' ORDER BY full_name").all() as unknown as TeacherRow[]).map(
    teacherDto,
  )

export function meDto(id: string, role: Role = id === 'admin' ? 'admin' : 'teacher'): Me {
  if (role === 'admin') return { id: 'admin', fullName: 'Rahbariyat', role: 'admin', branchId: '', isCoordinator: false }
  if (role === 'director') {
    const d = directorRow(id) ?? fail(404, 'Direktor topilmadi')
    return { id: d.id, fullName: d.full_name, role: 'director', branchId: d.branch_id, org: orgOf(d.branch_id), isCoordinator: false, telegramLinked: d.telegram_id != null }
  }
  const t = getTeacher(id)
  return {
    id: t.id,
    fullName: t.fullName,
    role: 'teacher',
    branchId: t.branchId,
    org: orgOf(t.branchId),
    isCoordinator: t.isCoordinator,
    telegramLinked: t.telegramLinked,
  }
}

// ---------- Direktorlar ----------

export interface DirectorRow {
  id: string
  full_name: string
  login: string
  password_hash: string
  phone: string
  branch_id: string
  telegram_id: number | null
  created_at: string
}

export const directorRow = (id: string) =>
  db().prepare('SELECT * FROM directors WHERE id = ?').get(id) as unknown as DirectorRow | undefined

export const directorOfBranch = (branchId: string) =>
  db().prepare('SELECT * FROM directors WHERE branch_id = ?').get(branchId) as unknown as DirectorRow | undefined

/** Login band emasmi: o'qituvchilar, direktorlar va rahbariyat orasida yagona bo'lishi kerak */
export function loginTaken(login: string, adminLogin: string, exceptDirectorId?: string) {
  if (login === adminLogin) return true
  if (db().prepare('SELECT 1 FROM teachers WHERE login = ?').get(login)) return true
  return Boolean(db().prepare('SELECT 1 FROM directors WHERE login = ? AND id != ?').get(login, exceptDirectorId ?? ''))
}

/** O'rinbosarni tasdiqlay oladiganlar (bot xabarlari uchun): filial direktori + mas'ul o'qituvchilar */
export interface Approver {
  kind: 'director' | 'teacher'
  id: string
  fullName: string
  telegramId: number | null
}
export function approversOf(branchId: string): Approver[] {
  const coordinators = (
    db()
      .prepare("SELECT id, full_name, telegram_id FROM teachers WHERE branch_id = ? AND is_coordinator = 1 AND status = 'active'")
      .all(branchId) as { id: string; full_name: string; telegram_id: number | null }[]
  ).map((t) => ({ kind: 'teacher' as const, id: t.id, fullName: t.full_name, telegramId: t.telegram_id }))
  const d = directorOfBranch(branchId)
  return d ? [{ kind: 'director', id: d.id, fullName: d.full_name, telegramId: d.telegram_id }, ...coordinators] : coordinators
}

// ---------- Darslar ----------

const teacherNameStmt = () => db().prepare('SELECT full_name FROM teachers WHERE id = ?')

export function lessonDto(r: LessonRow): Lesson {
  const name = (teacherNameStmt().get(r.teacher_id) as { full_name: string } | undefined)?.full_name ?? ''
  return {
    id: r.id,
    weekday: r.weekday,
    para: r.para,
    startTime: r.start_time,
    endTime: r.end_time,
    className: r.class_name,
    subject: r.subject,
    room: r.room,
    teacherId: r.teacher_id,
    teacherName: name,
    branchId: r.branch_id,
  }
}

/** Ustozning shu sanadagi (hafta kuni bo'yicha) darslari, para tartibida */
export const lessonsOn = (teacherId: string, date: string): Lesson[] =>
  (
    db()
      .prepare('SELECT * FROM lessons WHERE teacher_id = ? AND weekday = ? ORDER BY para')
      .all(teacherId, weekdayOf(date)) as unknown as LessonRow[]
  ).map(lessonDto)

export const lessonsOfBranch = (branchId: string): Lesson[] =>
  (
    db().prepare('SELECT * FROM lessons WHERE branch_id = ? ORDER BY weekday, para, class_name').all(branchId) as unknown as LessonRow[]
  ).map(lessonDto)

// ---------- Sozlamalar ----------

export const DEFAULT_SETTINGS: Settings = {
  noticeDeadline: '07:00',
  dailyLimit: 2,
  offerTimeoutMinutes: 30,
  offerBatchSize: 0,
  attendanceCheck: false,
  attendanceAskMinutes: 30,
  attendanceEscalateMinutes: 15,
  workDays: [1, 2, 3, 4, 5, 6],
  allowCrossBranch: false,
  paymentPerLesson: 0,
}

export function getSettings(): Settings {
  const r = db().prepare('SELECT value FROM settings WHERE id = 1').get() as { value: string } | undefined
  return r ? { ...DEFAULT_SETTINGS, ...JSON.parse(r.value) } : { ...DEFAULT_SETTINGS }
}

export function putSettings(s: Settings) {
  db()
    .prepare('INSERT INTO settings (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value')
    .run(JSON.stringify(s))
}
