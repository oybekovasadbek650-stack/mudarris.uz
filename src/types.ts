// Butun loyiha uchun umumiy ma'lumot turlari.
// Backend shu shakldagi JSON qaytarishi kerak (batafsil: docs/api.md).

/** Tashkilot turi: bog'cha, maktab, akademiya — har birining o'z dizayni bor */
export type Org = 'kindergarten' | 'school' | 'academy'

export interface Branch {
  id: string
  name: string
  org: Org
}

/** pending = ro'yxatdan o'tgan, admin tasdig'ini kutmoqda; active = ishlayapti; rejected = rad etilgan */
export type AccountStatus = 'pending' | 'active' | 'rejected'

export interface Teacher {
  id: string
  fullName: string
  login: string
  status: AccountStatus
  registeredAt: string // "2026-11-20"
  phone: string
  subjects: string[]
  branchId: string
  telegramLinked: boolean
  isCoordinator: boolean // mas'ul shaxsmi
}

export type Role = 'teacher' | 'admin'

/** Tizimga kirgan foydalanuvchi */
export interface Me {
  id: string
  fullName: string
  role: Role
  branchId: string
  org?: Org // admin uchun bo'sh
  isCoordinator: boolean
}

/** Haftalik jadvaldagi bitta dars */
export interface Lesson {
  id: string
  weekday: number // 1 = Dushanba ... 6 = Shanba
  para: number // 1..6
  startTime: string // "08:00"
  endTime: string
  className: string // "7-A"
  subject: string
  room: string
  teacherId: string
  teacherName: string
  branchId: string
}

/** pending = qidirilmoqda, found = o'rinbosar topildi, not_found = topilmadi */
export type CaseStatus = 'pending' | 'found' | 'not_found'

export interface Candidate {
  teacherId: string
  fullName: string
  subjects: string[]
  sameSubject: boolean
  lessonsThatDay: number
  substitutionsThisMonth: number
}

/** Kelmagan ustozning bitta darsi uchun o'rinbosar qidiruvi */
export interface CoverCase {
  id: string
  absenceId: string
  date: string // "2026-11-20"
  lesson: Lesson
  absentTeacher: { id: string; fullName: string }
  reason: string
  status: CaseStatus
  candidates: Candidate[] // taklifni qabul qilgan ustozlar
  chosenTeacher?: { id: string; fullName: string }
}

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

/** O'qituvchiga yuborilgan "o'rniga kira olasizmi?" taklifi */
export interface Offer {
  id: string
  caseId: string
  date: string
  lesson: Lesson
  absentTeacherName: string
  status: OfferStatus
  assigned: boolean // mas'ul shaxs aynan shu ustozni tanlaganmi
}

export interface Settings {
  noticeHours: number // necha soat oldin xabar berish kerak
  dailyLimit: number // bir ustoz bir kunda nechta o'rinbosar darsga kira oladi
  allowCrossBranch: boolean // boshqa filial ustozlari ham nomzod bo'la oladimi
  paymentPerLesson: number // bitta o'rinbosar dars uchun haq (so'm)
}

export interface MonthlyReportRow {
  teacherId: string
  fullName: string
  absentDays: number
  substitutedLessons: number
  payment: number
}
