// SOXTA API — backend tayyor bo'lguncha frontend shu bilan ishlaydi.
// Ma'lumotlar xotirada saqlanadi, sahifa yangilanganda boshlang'ich holatga qaytadi.
// Bu yerdagi qoidalar (nomzod tanlash va h.k.) backend uchun namuna: docs/api.md ga qarang.
import type {
  Branch,
  CaseStatus,
  Candidate,
  CoverCase,
  Lesson,
  Me,
  MonthlyReportRow,
  Org,
  Offer,
  OfferStatus,
  Settings,
  Teacher,
} from '../types'
import type { Api, DayOverview, NewAbsence, RegisterInput, TeacherInput } from './contract'
import { clearToken, getToken } from '../lib/auth'
import { addDays, todayISO, weekdayOf } from '../lib/date'

const DELAY = 350

const ok = <T,>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), DELAY))
const fail = (message: string) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), DELAY))

/** Soxta token: "mock.<foydalanuvchi id>" */
const ADMIN_ID = 'admin'
const tokenUserId = () => getToken()?.replace(/^mock./, '')
function meId() {
  const id = tokenUserId()
  if (!id || !teachers.some((t) => t.id === id && t.status === 'active')) throw new Error('Avval tizimga kiring')
  return id
}
function requireAdmin() {
  if (tokenUserId() !== ADMIN_ID) throw new Error('Faqat rahbariyat uchun')
}

let seq = 1000
const newId = (prefix: string) => `${prefix}${++seq}`

// ---------- Boshlang'ich ma'lumotlar ----------

const PARAS: [string, string][] = [
  ['08:00', '08:45'],
  ['08:55', '09:40'],
  ['09:50', '10:35'],
  ['10:45', '11:30'],
  ['11:40', '12:25'],
  ['12:35', '13:20'],
]
const GROUPS: Record<Org, string[]> = {
  school: ['5-A', '6-B', '7-A', '8-V', '9-A', '10-B', '11-A'],
  academy: ['IELTS-1', 'IELTS-2', 'Math-A', 'Math-B', 'SAT', 'Kids English'],
  kindergarten: ['Kichik guruh', "O'rta guruh", 'Katta guruh', 'Tayyorlov guruhi'],
}

const branches: Branch[] = [
  { id: 'b1', name: 'Maktab — Chilonzor', org: 'school' },
  { id: 'b2', name: 'Maktab — Yunusobod', org: 'school' },
  { id: 'b3', name: 'Akademiya — Markaz', org: 'academy' },
  { id: 'b4', name: "Bog'cha — Chilonzor", org: 'kindergarten' },
]

const teachers: Teacher[] = [
  { id: 't1', login: 'aziza', status: 'active', registeredAt: '2026-09-01', fullName: 'Aziza Karimova', phone: '+998 90 111 22 33', subjects: ['Matematika'], branchId: 'b1', telegramLinked: true, isCoordinator: true },
  { id: 't2', login: 'bekzod', status: 'active', registeredAt: '2026-09-01', fullName: 'Bekzod Tursunov', phone: '+998 91 222 33 44', subjects: ['Fizika'], branchId: 'b1', telegramLinked: true, isCoordinator: false },
  { id: 't3', login: 'dilnoza', status: 'active', registeredAt: '2026-09-01', fullName: 'Dilnoza Rahimova', phone: '+998 93 333 44 55', subjects: ['Ingliz tili'], branchId: 'b1', telegramLinked: true, isCoordinator: false },
  { id: 't4', login: 'jasur', status: 'active', registeredAt: '2026-09-01', fullName: 'Jasur Aliyev', phone: '+998 94 444 55 66', subjects: ['Matematika', 'Fizika'], branchId: 'b1', telegramLinked: false, isCoordinator: false },
  { id: 't5', login: 'malika', status: 'active', registeredAt: '2026-09-01', fullName: 'Malika Yusupova', phone: '+998 95 555 66 77', subjects: ['Ona tili'], branchId: 'b1', telegramLinked: true, isCoordinator: false },
  { id: 't6', login: 'sardor', status: 'active', registeredAt: '2026-09-01', fullName: 'Sardor Qodirov', phone: '+998 97 666 77 88', subjects: ['Tarix'], branchId: 'b2', telegramLinked: true, isCoordinator: true },
  { id: 't7', login: 'nodira', status: 'active', registeredAt: '2026-09-01', fullName: 'Nodira Ergasheva', phone: '+998 98 777 88 99', subjects: ['Kimyo', 'Biologiya'], branchId: 'b2', telegramLinked: true, isCoordinator: false },
  { id: 't8', login: 'otabek', status: 'active', registeredAt: '2026-09-01', fullName: 'Otabek Islomov', phone: '+998 99 888 99 00', subjects: ['Matematika'], branchId: 'b2', telegramLinked: false, isCoordinator: false },
  // Akademiya ustozlari
  { id: 't10', login: 'shahzod', status: 'active', registeredAt: '2026-09-01', fullName: 'Shahzod Rasulov', phone: '+998 90 222 11 00', subjects: ['IELTS'], branchId: 'b3', telegramLinked: true, isCoordinator: true },
  { id: 't11', login: 'madina', status: 'active', registeredAt: '2026-09-01', fullName: 'Madina Qosimova', phone: '+998 91 333 22 11', subjects: ['IELTS', 'SAT'], branchId: 'b3', telegramLinked: true, isCoordinator: false },
  { id: 't12', login: 'rustam', status: 'active', registeredAt: '2026-09-01', fullName: 'Rustam Ergashev', phone: '+998 93 444 33 22', subjects: ['Matematika'], branchId: 'b3', telegramLinked: true, isCoordinator: false },
  // Bog'cha tarbiyachilari
  { id: 't13', login: 'gulnora', status: 'active', registeredAt: '2026-09-01', fullName: 'Gulnora Saidova', phone: '+998 94 555 44 33', subjects: ["Rivojlantiruvchi o'yinlar"], branchId: 'b4', telegramLinked: true, isCoordinator: true },
  { id: 't14', login: 'zarina', status: 'active', registeredAt: '2026-09-01', fullName: 'Zarina Toshpulatova', phone: '+998 95 666 55 44', subjects: ['Musiqa'], branchId: 'b4', telegramLinked: true, isCoordinator: false },
  { id: 't15', login: 'feruza', status: 'active', registeredAt: '2026-09-01', fullName: 'Feruza Aminova', phone: '+998 97 777 66 55', subjects: ['Rasm', 'Ingliz tili'], branchId: 'b4', telegramLinked: false, isCoordinator: false },
  // Ro'yxatdan o'tgan, tasdiq kutayotgan o'qituvchi (demo)
  { id: 't9', login: 'kamola', status: 'pending', registeredAt: todayISO(), fullName: 'Kamola Nazarova', phone: '+998 90 123 45 67', subjects: ['Geografiya'], branchId: 'b1', telegramLinked: false, isCoordinator: false },
]

/** Demo parollar (faqat soxta API uchun). Hamma o'qituvchi: 123456, admin: admin123 */
const passwords = new Map<string, string>([[ADMIN_ID, 'admin123'], ...teachers.map((t) => [t.id, '123456'] as [string, string])])

let lessons: Lesson[] = []
teachers.forEach((t, i) => {
  if (t.status !== 'active') return
  for (let w = 1; w <= 6; w++) {
    for (let p = 1; p <= 6; p++) {
      if ((i * 2 + w + p) % 3 !== 0) continue
      const [startTime, endTime] = PARAS[p - 1]
      lessons.push({
        id: `l-${t.id}-${w}-${p}`,
        weekday: w,
        para: p,
        startTime,
        endTime,
        className: GROUPS[orgOf(t.branchId)][(i + w + p) % GROUPS[orgOf(t.branchId)].length],
        subject: t.subjects[0],
        room: `${p}${String((i % 9) + 1).padStart(2, '0')}`,
        teacherId: t.id,
        teacherName: t.fullName,
        branchId: t.branchId,
      })
    }
  }
})

const settings: Settings = {
  noticeHours: 12,
  dailyLimit: 2,
  allowCrossBranch: false,
  paymentPerLesson: 50000,
}

interface AbsenceRec { id: string; teacherId: string; date: string; reason: string }
interface CaseRec { id: string; absenceId: string; date: string; lessonId: string; status: CaseStatus; chosenTeacherId?: string }
interface OfferRec { id: string; caseId: string; teacherId: string; status: OfferStatus }

const absences: AbsenceRec[] = []
const cases: CaseRec[] = []
const offers: OfferRec[] = []

// ---------- Qoidalar ----------

function orgOf(branchId: string): Org {
  return branches.find((b) => b.id === branchId)?.org ?? 'school'
}
const teacherById = (id: string) => teachers.find((t) => t.id === id)!
const lessonById = (id: string) => lessons.find((l) => l.id === id)!
const lessonsOn = (teacherId: string, date: string) =>
  lessons
    .filter((l) => l.teacherId === teacherId && l.weekday === weekdayOf(date))
    .sort((a, b) => a.para - b.para)

const assignedCount = (teacherId: string, date: string) =>
  cases.filter((c) => c.date === date && c.chosenTeacherId === teacherId).length

const substitutionsInMonth = (teacherId: string, month: string) =>
  cases.filter((c) => c.date.startsWith(month) && c.chosenTeacherId === teacherId).length

/**
 * Nomzod bo'la oladigan ustozlar:
 * 1) o'sha kuni kelmayotgan bo'lmasin, 2) o'sha parada o'z darsi bo'lmasin,
 * 3) kunlik chegaradan oshmagan bo'lsin, 4) filiali bir xil (sozlamaga qarab).
 * Saralash: avval fani mos keladiganlar, keyin bu oy kamroq o'rinbosar bo'lganlar.
 */
function rankFreeTeachers(lesson: Lesson, date: string): Teacher[] {
  const absentIds = absences.filter((a) => a.date === date).map((a) => a.teacherId)
  const month = date.slice(0, 7)
  return teachers
    .filter(
      (t) =>
        t.status === 'active' &&
        t.id !== lesson.teacherId &&
        !absentIds.includes(t.id) &&
        (settings.allowCrossBranch || t.branchId === lesson.branchId) &&
        !lessonsOn(t.id, date).some((l) => l.para === lesson.para) &&
        assignedCount(t.id, date) < settings.dailyLimit,
    )
    .sort((a, b) => {
      const sa = a.subjects.includes(lesson.subject) ? 0 : 1
      const sb = b.subjects.includes(lesson.subject) ? 0 : 1
      return sa - sb || substitutionsInMonth(a.id, month) - substitutionsInMonth(b.id, month)
    })
}

function openAbsence(teacherId: string, date: string, reason: string, lessonIds?: string[]) {
  const absence: AbsenceRec = { id: newId('a'), teacherId, date, reason }
  absences.push(absence)
  const target = lessonsOn(teacherId, date).filter((l) => !lessonIds || lessonIds.includes(l.id))
  return target.map((lesson) => {
    const rec: CaseRec = { id: newId('c'), absenceId: absence.id, date, lessonId: lesson.id, status: 'pending' }
    cases.push(rec)
    const free = rankFreeTeachers(lesson, date).slice(0, 3)
    if (free.length === 0) rec.status = 'not_found'
    free.forEach((t) => offers.push({ id: newId('o'), caseId: rec.id, teacherId: t.id, status: 'pending' }))
    return rec.id
  })
}

/** Hamma taklif rad etilsa yoki muddati o'tsa — "topilmadi" */
function recalc(caseId: string) {
  const c = cases.find((x) => x.id === caseId)!
  if (c.status !== 'pending') return
  const list = offers.filter((o) => o.caseId === caseId)
  if (list.length > 0 && list.every((o) => o.status === 'rejected' || o.status === 'expired')) {
    c.status = 'not_found'
  }
}

function setOffer(caseId: string | undefined, teacherId: string, status: OfferStatus) {
  const o = offers.find((x) => x.caseId === caseId && x.teacherId === teacherId)
  if (!o) return
  o.status = status
  recalc(o.caseId)
}

function choose(caseId: string, teacherId: string) {
  const c = cases.find((x) => x.id === caseId)!
  c.status = 'found'
  c.chosenTeacherId = teacherId
  offers
    .filter((o) => o.caseId === caseId && o.status === 'pending')
    .forEach((o) => (o.status = 'expired'))
}

// ---------- Namuna holatlar (bugun + o'tgan kunlar) ----------

function workday(offset: number) {
  let d = todayISO()
  if (weekdayOf(d) === 7) d = addDays(d, 1) // yakshanba bo'lsa — dushanbani ko'rsatamiz
  let left = Math.abs(offset)
  while (left > 0) {
    d = addDays(d, offset < 0 ? -1 : 1)
    if (weekdayOf(d) !== 7) left--
  }
  return d
}

;(function seed() {
  // O'tgan kunlar — oylik hisobot bo'sh bo'lmasligi uchun
  const history: [string, number, string][] = [
    ['t5', -2, 'Oilaviy sabab'],
    ['t3', -4, 'Kasal'],
    ['t2', -6, 'Malaka oshirish kursi'],
    ['t7', -3, 'Kasal'],
  ]
  for (const [tid, offset, reason] of history) {
    for (const caseId of openAbsence(tid, workday(offset), reason)) {
      const list = offers.filter((o) => o.caseId === caseId)
      const pick = list.find((o) => o.teacherId === 't1') ?? list[0]
      if (!pick) continue
      pick.status = 'accepted'
      choose(caseId, pick.teacherId)
    }
  }

  // Bugun: Bekzod (t2) kelmaydi — ikkala darsi uchun qidiruv davom etmoqda
  const today = workday(0)
  const [c1, c2] = openAbsence('t2', today, "Kasal bo'lib qoldim, shifokorga boraman")
  setOffer(c1, 't3', 'accepted')
  setOffer(c1, 't4', 'accepted')
  setOffer(c2, 't3', 'rejected')
  setOffer(c2, 't4', 'rejected')
  // Aziza (t1, ya'ni "men") ikkala dars uchun ham taklif oldi va hali javob bermadi

  // Bugun: Sardor (t6) kelmaydi — biri topildi, biri topilmadi
  const [c3, c4] = openAbsence('t6', today, 'Viloyatga safar')
  setOffer(c3, 't7', 'accepted')
  if (c3) choose(c3, 't7')
  setOffer(c4, 't7', 'rejected')
  setOffer(c4, 't8', 'rejected')

  // Bog'cha: Zarina (t14) kelmaydi — biri topildi, biri tanlov kutmoqda
  const [k1, k2] = openAbsence('t14', today, 'Farzandim kasal')
  setOffer(k1, 't15', 'accepted')
  if (k1) choose(k1, 't15')
  setOffer(k2, 't13', 'accepted')

  // Akademiya: Rustam (t12) kelmaydi — nomzodlar javobi kutilmoqda
  const [a1] = openAbsence('t12', today, 'Seminarga ketyapman')
  setOffer(a1, 't11', 'accepted')
})()

// ---------- Ma'lumotni sahifa uchun yig'ish ----------

function toCase(c: CaseRec): CoverCase {
  const lesson = lessonById(c.lessonId)
  const absence = absences.find((a) => a.id === c.absenceId)!
  const absent = teacherById(absence.teacherId)
  const month = c.date.slice(0, 7)
  const candidates: Candidate[] = offers
    .filter((o) => o.caseId === c.id && o.status === 'accepted')
    .slice(0, 3)
    .map((o) => {
      const t = teacherById(o.teacherId)
      return {
        teacherId: t.id,
        fullName: t.fullName,
        subjects: t.subjects,
        sameSubject: t.subjects.includes(lesson.subject),
        lessonsThatDay: lessonsOn(t.id, c.date).length,
        substitutionsThisMonth: substitutionsInMonth(t.id, month),
      }
    })
  const chosen = c.chosenTeacherId ? teacherById(c.chosenTeacherId) : undefined
  return {
    id: c.id,
    absenceId: c.absenceId,
    date: c.date,
    lesson,
    absentTeacher: { id: absent.id, fullName: absent.fullName },
    reason: absence.reason,
    status: c.status,
    candidates,
    chosenTeacher: chosen && { id: chosen.id, fullName: chosen.fullName },
  }
}

function toOffer(o: OfferRec): Offer {
  const c = cases.find((x) => x.id === o.caseId)!
  const absence = absences.find((a) => a.id === c.absenceId)!
  return {
    id: o.id,
    caseId: c.id,
    date: c.date,
    lesson: lessonById(c.lessonId),
    absentTeacherName: teacherById(absence.teacherId).fullName,
    status: o.status,
    assigned: c.chosenTeacherId === o.teacherId,
  }
}

const byDateAndPara = (a: { date: string; lesson: Lesson }, b: { date: string; lesson: Lesson }) =>
  a.date.localeCompare(b.date) || a.lesson.para - b.lesson.para

function toMe(id: string): Me {
  if (id === ADMIN_ID) return { id, fullName: 'Rahbariyat', role: 'admin', branchId: '', isCoordinator: false }
  const t = teacherById(id)
  return { id: t.id, fullName: t.fullName, role: 'teacher', branchId: t.branchId, org: orgOf(t.branchId), isCoordinator: t.isCoordinator }
}

// ---------- API ----------

// ---------- Saqlash: hamma oynalar uchun umumiy (localStorage) ----------
// Bir oynada qilingan o'zgarish (ro'yxatdan o'tish, tasdiqlash...) boshqa oynada ham ko'rinadi.

export const MOCK_DB_KEY = 'orinbosar-mock-db'
const DB_VERSION = 4

function saveDb() {
  try {
    localStorage.setItem(
      MOCK_DB_KEY,
      JSON.stringify({ v: DB_VERSION, seq, teachers, passwords: [...passwords], lessons, settings, absences, cases, offers }),
    )
  } catch {
    /* localStorage yopiq — faqat shu oynada ishlaydi */
  }
}

const refill = <T,>(target: T[], next: T[]) => target.splice(0, target.length, ...next)

function loadDb() {
  try {
    const raw = localStorage.getItem(MOCK_DB_KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    if (d.v !== DB_VERSION) return
    seq = d.seq
    refill(teachers, d.teachers)
    passwords.clear()
    for (const [k, v] of d.passwords as [string, string][]) passwords.set(k, v)
    lessons = d.lessons
    Object.assign(settings, d.settings)
    refill(absences, d.absences)
    refill(cases, d.cases)
    refill(offers, d.offers)
  } catch {
    /* buzilgan ma'lumot — boshlang'ich holat qoladi */
  }
}

/** Demo ma'lumotlarni boshlang'ich holatga qaytarish */
export function resetMockDb() {
  try {
    localStorage.removeItem(MOCK_DB_KEY)
  } catch {
    /* localStorage yopiq */
  }
  window.location.reload()
}

const rawApi: Api = {
  login(login, password) {
    const key = login.trim().toLowerCase()
    const userId = key === ADMIN_ID ? ADMIN_ID : teachers.find((t) => t.login === key)?.id
    if (!userId || passwords.get(userId) !== password) return fail("Login yoki parol noto'g'ri")
    if (userId !== ADMIN_ID) {
      const t = teacherById(userId)
      if (t.status === 'pending') return fail('Hisobingiz hali tasdiqlanmagan. Rahbariyat tasdiqlashini kuting.')
      if (t.status === 'rejected') return fail("Ro'yxatdan o'tish arizangiz rad etilgan. Rahbariyat bilan bog'laning.")
    }
    return ok({ token: `mock.${userId}`, user: toMe(userId) })
  },

  register(input: RegisterInput) {
    const login = input.login.trim().toLowerCase()
    if (input.fullName.trim().split(/\s+/).length < 2) return fail("Ism va familiyani to'liq yozing")
    if (!/^[a-z0-9_.]{4,20}$/.test(login)) return fail("Login 4–20 ta lotin harfi, raqam, _ yoki . dan iborat bo'lsin")
    if (login === ADMIN_ID || teachers.some((t) => t.login === login)) return fail('Bu login band, boshqasini tanlang')
    if (input.password.length < 6) return fail("Parol kamida 6 ta belgidan iborat bo'lsin")
    if (input.subjects.length === 0) return fail('Kamida bitta fanni tanlang')
    if (!branches.some((b) => b.id === input.branchId)) return fail('Filialni tanlang')
    const t: Teacher = {
      id: newId('t'),
      login,
      status: 'pending',
      registeredAt: todayISO(),
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      subjects: input.subjects,
      branchId: input.branchId,
      telegramLinked: false,
      isCoordinator: false,
    }
    teachers.push(t)
    passwords.set(t.id, input.password)
    return ok({ status: 'pending' as const })
  },

  getMe() {
    const id = tokenUserId()
    const valid = id === ADMIN_ID || teachers.some((t) => t.id === id && t.status === 'active')
    if (!id || !valid) {
      clearToken()
      return fail('Avval tizimga kiring')
    }
    return ok(toMe(id))
  },

  getMyLessons(date) {
    return ok(lessonsOn(meId(), date))
  },

  getMyOffers() {
    return ok(offers.filter((o) => o.teacherId === meId()).map(toOffer).sort(byDateAndPara))
  },

  respondOffer(offerId, accept) {
    const o = offers.find((x) => x.id === offerId && x.teacherId === meId())
    if (!o) return fail('Taklif topilmadi')
    if (o.status !== 'pending') return fail('Bu taklifga allaqachon javob berilgan yoki muddati o\'tgan')
    o.status = accept ? 'accepted' : 'rejected'
    recalc(o.caseId)
    return ok(toOffer(o))
  },

  getMySubstitutions() {
    return ok(
      offers
        .filter((o) => o.teacherId === meId() && o.status === 'accepted')
        .map(toOffer)
        .sort((a, b) => byDateAndPara(b, a)),
    )
  },

  createAbsence({ date, reason, lessonIds }: NewAbsence) {
    if (date < todayISO()) return fail("O'tgan sana uchun ariza yuborib bo'lmaydi")
    if (!reason.trim()) return fail('Sababni yozing')
    if (lessonIds.length === 0) return fail('Kamida bitta darsni tanlang')
    if (absences.some((a) => a.teacherId === meId() && a.date === date)) {
      return fail('Bu sana uchun ariza allaqachon yuborilgan')
    }
    const ids = openAbsence(meId(), date, reason.trim(), lessonIds)
    return ok({ id: cases.find((c) => c.id === ids[0])?.absenceId ?? '', casesCount: ids.length })
  },

  getCases() {
    const me = teacherById(meId())
    if (!me.isCoordinator) return fail("Bu bo'lim faqat mas'ul shaxs uchun")
    return ok(
      cases
        .filter((c) => c.date >= todayISO() && lessonById(c.lessonId).branchId === me.branchId)
        .map(toCase)
        .sort(byDateAndPara),
    )
  },

  getCase(id) {
    const c = cases.find((x) => x.id === id)
    return c ? ok(toCase(c)) : fail('Holat topilmadi')
  },

  chooseCandidate(caseId, teacherId) {
    const c = cases.find((x) => x.id === caseId)
    if (!c) return fail('Holat topilmadi')
    if (c.status !== 'pending') return fail("Bu dars uchun o'rinbosar allaqachon hal qilingan")
    if (!offers.some((o) => o.caseId === caseId && o.teacherId === teacherId && o.status === 'accepted')) {
      return fail('Bu ustoz taklifni qabul qilmagan')
    }
    choose(caseId, teacherId)
    return ok(toCase(c))
  },

  getBranches() {
    return ok(branches)
  },

  getDayOverview(date, branchId) {
    requireAdmin()
    const result: DayOverview = {
      date,
      absences: absences
        .filter((a) => a.date === date && (!branchId || teacherById(a.teacherId).branchId === branchId))
        .map((a) => ({
          id: a.id,
          teacher: teacherById(a.teacherId),
          reason: a.reason,
          cases: cases.filter((c) => c.absenceId === a.id).map(toCase).sort(byDateAndPara),
        })),
    }
    return ok(result)
  },

  getSchedule(branchId) {
    requireAdmin()
    return ok(lessons.filter((l) => l.branchId === branchId))
  },

  importSchedule(file) {
    requireAdmin()
    return ok({
      imported: 0,
      errors: [
        `Demo rejim: "${file.name}" backendga yuborilmadi. Backend ulanganda fayl serverda o'qiladi va jadval yangilanadi.`,
      ],
    })
  },

  getTeachers() {
    requireAdmin()
    return ok(teachers)
  },

  saveTeacher(input: TeacherInput) {
    requireAdmin()
    if (!input.fullName.trim()) return fail('Ism-familiyani kiriting')
    if (input.subjects.length === 0) return fail('Kamida bitta fan kiriting')
    const t = teachers.find((x) => x.id === input.id)
    if (!t) return fail("O'qituvchi topilmadi")
    Object.assign(t, input)
    lessons = lessons.map((l) => (l.teacherId === t.id ? { ...l, teacherName: t.fullName } : l))
    return ok(t)
  },

  approveTeacher(id) {
    requireAdmin()
    const t = teachers.find((x) => x.id === id)
    if (!t) return fail("O'qituvchi topilmadi")
    t.status = 'active'
    return ok(t)
  },

  rejectTeacher(id) {
    requireAdmin()
    const t = teachers.find((x) => x.id === id)
    if (!t) return fail("O'qituvchi topilmadi")
    t.status = 'rejected'
    return ok(t)
  },

  getSettings() {
    requireAdmin()
    return ok(settings)
  },

  saveSettings(next) {
    requireAdmin()
    if (next.dailyLimit < 1) return fail("Kunlik chegara kamida 1 bo'lishi kerak")
    if (next.noticeHours < 0 || next.paymentPerLesson < 0) return fail("Manfiy qiymat bo'lishi mumkin emas")
    Object.assign(settings, next)
    return ok(settings)
  },

  getMonthlyReport(month) {
    requireAdmin()
    const rows: MonthlyReportRow[] = teachers.filter((t) => t.status === 'active').map((t) => {
      const absentDays = new Set(
        absences.filter((a) => a.teacherId === t.id && a.date.startsWith(month)).map((a) => a.date),
      ).size
      const substitutedLessons = substitutionsInMonth(t.id, month)
      return {
        teacherId: t.id,
        fullName: t.fullName,
        absentDays,
        substitutedLessons,
        payment: substitutedLessons * settings.paymentPerLesson,
      }
    })
    return ok(rows)
  },
}

/** Har chaqiruvdan oldin umumiy bazani o'qiymiz, keyin (o'zgarish sinxron bo'lgani uchun darhol) saqlaymiz */
export const mockApi = Object.fromEntries(
  Object.entries(rawApi).map(([name, fn]) => [
    name,
    (...args: unknown[]) => {
      loadDb()
      try {
        const result = (fn as (...a: unknown[]) => Promise<unknown>)(...args)
        saveDb()
        return result
      } catch (e) {
        return Promise.reject(e)
      }
    },
  ]),
) as unknown as Api
