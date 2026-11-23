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
  subjects: string[] // asosiy fanlar
  extraSubjects?: string[] // qo'shimcha fanlar — o'rinbosar sifatida bularni ham o'ta oladi
  branchId: string
  telegramLinked: boolean
  isCoordinator: boolean // mas'ul shaxsmi
  davomatCode?: string // davomat tizimidagi xodim kodi (bog'langan bo'lsa)
}

// ---------- Panel: haftalik trend va yaqin kunlar ----------

export interface DayStat {
  date: string
  absences: number // kelmagan ustozlar
  found: number // darslar: o'rinbosar topildi
  pending: number // kutilmoqda
  notFound: number // topilmadi
}

export interface UpcomingAbsence {
  date: string
  absenceId: string
  teacherName: string
  branchId: string
  reason: string
  found: number
  pending: number
  notFound: number
}

export interface DashboardStats {
  week: DayStat[]
  upcoming: UpcomingAbsence[]
}

// ---------- Davomat tizimi integratsiyasi ----------

/** Davomat bo'yicha hali kelmagan ustoz (bugun) */
export interface AttendanceMissing {
  teacherId: string
  fullName: string
  branchId: string
  date: string
  firstLesson: { para: number; startTime: string; className: string; subject: string }
  /** asked — botda so'raldi, javob kutilmoqda; escalated — javob yo'q / Telegram ulanmagan */
  stage: 'asked' | 'escalated'
  reason?: 'no_answer' | 'no_telegram'
}

/** Davomatdagi xodim va uning bizdagi holati */
export interface DavomatEmployeeView {
  code: string
  fullName: string
  departmentName: string // davomatdagi filial nomi
  branchId: string | null // bizdagi filial (sinxronlangan bo'lsa)
  /** linked — allaqachon bog'langan; match — shu ismli o'qituvchi bor (bog'lanadi); new — yangi hisob ochiladi; no_branch — filial sinxronlanmagan */
  status: 'linked' | 'match' | 'new' | 'no_branch'
  teacherId?: string
  teacherName?: string
}

export interface DavomatSyncResult {
  created: string[]
  updated: string[]
  total: number
  notInDavomat: string[] // bizda bor, davomatda yo'q filiallar (o'chirilmaydi)
}

export interface DavomatImportResult {
  linked: string[]
  created: { fullName: string; login: string; password: string; branchName: string }[]
  skipped: string[]
}

/** teacher — o'qituvchi (Mini App); director — filial direktori (panel, faqat o'z filiali); admin — umumiy rahbariyat */
export type Role = 'teacher' | 'admin' | 'director'

// ---------- Sozlamalar: umumiy -> tashkilot turi -> filial ----------

/** Filial yoki tashkilot turi bo'yicha alohida bo'la oladigan sozlamalar ("boshqa filialga o'tish" — faqat umumiy) */
export const BRANCH_SETTING_KEYS = [
  'noticeDeadline',
  'dailyLimit',
  'offerTimeoutMinutes',
  'offerBatchSize',
  'paymentPerLesson',
  'workDays',
  'attendanceCheck',
  'attendanceAskMinutes',
  'attendanceEscalateMinutes',
] as const
export type BranchSettingKey = (typeof BRANCH_SETTING_KEYS)[number]
/** Faqat o'zgartirilgan qiymatlar; qolgani yuqori darajadan meros */
export type SettingsOverride = Partial<Pick<Settings, BranchSettingKey>>

export interface SettingsTree {
  global: Settings
  orgs: Partial<Record<Org, SettingsOverride>>
  branches: Record<string, SettingsOverride>
}

/** Panelga kira oladigan rollar */
export const isPanelRole = (r: Role) => r === 'admin' || r === 'director'

/** Filiallar sahifasi uchun: filial + direktori + o'qituvchilar soni */
export interface AdminBranch extends Branch {
  director: { id: string; fullName: string; login: string; phone: string; telegramLinked: boolean } | null
  teachersCount: number
}

export interface DirectorInput {
  fullName: string
  login: string
  phone: string
  password?: string // yangi direktor uchun majburiy; mavjudida — bo'sh qoldirilsa o'zgarmaydi
}

/** Botda "Filial direktori" lavozimi bilan ro'yxatdan o'tgan — umumiy rahbariyat tasdiqlaydi */
export interface DirectorRequest {
  id: string
  fullName: string
  phone: string
  branchId: string
  branchName: string
  /** Hozirgi direktor (tasdiqlansa almashtiriladi) */
  currentDirector: string | null
  createdAt: string
}

/** Tizimga kirgan foydalanuvchi */
export interface Me {
  id: string
  fullName: string
  role: Role
  branchId: string
  org?: Org // admin uchun bo'sh
  isCoordinator: boolean
  telegramLinked?: boolean // bot xabarlari keladimi
  workDays?: number[] // o'z filialining ish kunlari (1..7)
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
  lateNotice?: boolean // ariza belgilangan muddatdan keyin yuborilgan
  status: CaseStatus
  candidates: Candidate[] // taklifni qabul qilgan ustozlar
  chosenTeacher?: { id: string; fullName: string }
  chosenBy?: string // kim tasdiqladi: "Direktor: Ism", "Mas'ul: Ism", "Rahbariyat"
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
  expiresAt?: string // ISO vaqt — javob kutilayotgan taklif shu paytgacha amal qiladi
}

export interface Settings {
  noticeDeadline: string // "07:00" — dars kuni shu soatgacha xabar berish kerak, keyin "kech xabar"
  dailyLimit: number // bir ustoz bir kunda nechta o'rinbosar darsga kira oladi
  offerTimeoutMinutes: number // taklifga javob berish muddati (daqiqa); o'tsa — navbatdagi nomzodga. Dars yaqin bo'lsa — darsdan 10 daq oldin
  /** Bir vaqtda nechta ustozga taklif: 0 = hamma mos ustozga birdaniga (tezkor), 1..10 = navbat bilan shuncha */
  offerBatchSize: number
  /** Davomat bo'yicha "kelmadi" signali: birinchi darsdan oldin kirish bo'lmasa — ustozdan so'rash */
  attendanceCheck: boolean
  attendanceAskMinutes: number // birinchi darsdan necha daqiqa oldin so'raladi
  attendanceEscalateMinutes: number // javob bo'lmasa necha daqiqadan keyin direktor/mas'ulga xabar
  workDays: number[] // ish kunlari: 1 = Dushanba ... 7 = Yakshanba (akademiyada yakshanba ham bo'lishi mumkin)
  allowCrossBranch: boolean // boshqa filial ustozlari ham nomzod bo'la oladimi
  paymentPerLesson: number // bitta o'rinbosar dars uchun haq (so'm)
}

export interface MonthlyReportRow {
  teacherId: string
  fullName: string
  branchId?: string
  absentDays: number // "Kela olmayman" arizasi bilan kelmagan kunlar
  substitutedLessons: number
  payment: number
  /** Davomat tizimidan (ustoz davomatga bog'langan va davomat ishlayotgan bo'lsa) */
  davomat?: DavomatMonthStats
}

/** Davomat bo'yicha oylik ko'rsatkichlar (oy boshidan kechagacha) */
export interface DavomatMonthStats {
  workingDays: number
  presentDays: number
  absentDays: number // davomatda kirish yo'q ish kunlari
  lateDays: number
  lateMinutes: number
  workedMinutes: number
  /** Davomatda kirish yo'q VA tizimda ariza ham yo'q kunlar — sababsiz kelmagan */
  unexplainedAbsentDates: string[]
}

export interface MonthlyReport {
  month: string
  rows: MonthlyReportRow[]
  /** enabled — integratsiya sozlangan; ok — ma'lumot olindi; error — nima uchun olinmadi */
  davomat: { enabled: boolean; ok: boolean; error?: string }
}
