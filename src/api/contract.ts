// API shartnomasi: frontend backenddan nimalarni kutadi.
// mock.ts ham, http.ts ham aynan shu interfeysni bajaradi.
import type {
  AttendanceMissing,
  DashboardStats,
  DavomatEmployeeView,
  DavomatImportResult,
  DavomatSyncResult,
  AdminBranch,
  DirectorInput,
  DirectorRequest,
  Org,
  Branch,
  CoverCase,
  Lesson,
  Me,
  MonthlyReport,
  Offer,
  Settings,
  SettingsOverride,
  SettingsTree,
  Teacher,
} from '../types'

export interface NewAbsence {
  date: string
  reason: string
  lessonIds: string[]
}

export interface DayOverview {
  date: string
  absences: {
    id: string
    teacher: Teacher
    reason: string
    lateNotice?: boolean
    cases: CoverCase[]
  }[]
}

export interface ScheduleImportResult {
  imported: number
  errors: string[]
}

/** Admin tahrirlay oladigan maydonlar (login/parolni o'qituvchining o'zi boshqaradi) */
export type TeacherInput = Pick<Teacher, 'id' | 'fullName' | 'phone' | 'subjects' | 'extraSubjects' | 'branchId' | 'isCoordinator'>

export interface RegisterInput {
  fullName: string
  phone: string
  branchId: string
  subjects: string[]
  login: string
  password: string
}

export interface LoginResult {
  token: string
  user: Me
}

/** Bot ichida ro'yxatdan o'tish: shu Telegram akkaunt holati */
export interface TgStatus {
  status: 'none' | 'pending' | 'rejected' | 'active'
  /** Botga "Raqamni ulashish" orqali kelgan (Telegram tasdiqlagan) raqam */
  phone: string | null
  /** Telegram profilidagi ism */
  suggestedName: string
  firstName: string
  lastName: string
  login?: string
  fullName?: string
  branchId?: string
}

export interface Api {
  // --- Kirish / ro'yxatdan o'tish (token talab qilinmaydi) ---
  login(login: string, password: string): Promise<LoginResult>
  /** Telegram ichida: avval bog'langan akkaunt bilan parolsiz kirish (faqat haqiqiy backendda) */
  loginWithTelegram?(): Promise<LoginResult>
  register(input: RegisterInput): Promise<{ status: 'pending' }>
  getBranches(): Promise<Branch[]>
  /** Bot orqali ro'yxat (faqat haqiqiy backendda, Telegram initData bilan) */
  tgStatus?(): Promise<TgStatus>
  /** Ro'yxat bot chatida: bot shu foydalanuvchiga birinchi savolni yuboradi */
  tgChatRegister?(): Promise<{ ok: true }>

  // --- O'qituvchi (Mini App) ---
  getMe(): Promise<Me>
  getMyLessons(date: string): Promise<Lesson[]>
  getMyOffers(): Promise<Offer[]>
  respondOffer(offerId: string, accept: boolean): Promise<Offer>
  getMySubstitutions(): Promise<Offer[]>
  createAbsence(input: NewAbsence): Promise<{ id: string; casesCount: number }>

  // --- Mas'ul shaxs (Mini App) ---
  getCases(): Promise<CoverCase[]>
  getCase(id: string): Promise<CoverCase>
  chooseCandidate(caseId: string, teacherId: string): Promise<CoverCase>

  // --- Rahbariyat paneli ---
  getDayOverview(date: string, branchId?: string): Promise<DayOverview>
  /** 7 kunlik trend (to sanagacha) + yaqin 7 kundagi arizalar */
  getDashboardStats(to: string, branchId?: string, org?: Org, days?: number): Promise<DashboardStats>
  getSchedule(branchId: string): Promise<Lesson[]>
  importSchedule(file: File): Promise<ScheduleImportResult>
  getTeachers(): Promise<Teacher[]>
  saveTeacher(input: TeacherInput): Promise<Teacher>
  approveTeacher(id: string): Promise<Teacher>
  rejectTeacher(id: string): Promise<Teacher>
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>
  /** Hamma darajalar: umumiy + tashkilot turlari + filiallar (direktor — o'z filiali) */
  getSettingsTree(): Promise<SettingsTree>
  /** Tashkilot turi yoki filial uchun qayta belgilash; bo'sh values — merosga qaytarish */
  saveSettingsOverride(scope: 'org' | 'branch', id: string, values: SettingsOverride): Promise<SettingsTree>
  /** Oylik hisobot: tizim ma'lumoti + davomat (ulangan bo'lsa) */
  getMonthlyReport(month: string): Promise<MonthlyReport>
  /** Paneldan o'rinbosarni tasdiqlash (direktor — o'z filiali, rahbariyat — hammasi) */
  approveCandidate(caseId: string, teacherId: string): Promise<CoverCase>

  // --- Filiallar va direktorlar (faqat umumiy rahbariyat) ---
  getAdminBranches(): Promise<AdminBranch[]>
  createBranch(input: { name: string; org: Org }): Promise<AdminBranch>
  updateBranch(id: string, input: { name: string; org: Org }): Promise<AdminBranch>
  saveDirector(branchId: string, input: DirectorInput): Promise<AdminBranch>
  /** Botdan kelgan direktorlik arizalari (faqat umumiy rahbariyat) */
  getDirectorRequests(): Promise<DirectorRequest[]>
  decideDirectorRequest(id: string, approve: boolean): Promise<{ ok: true }>

  /** Telegram'ni bog'lash uchun bir martalik havola (t.me/bot?start=link_...) */
  getTelegramLink(): Promise<{ url: string; expiresInMinutes: number }>

  // --- Davomat tizimi integratsiyasi (faqat o'qish) ---
  getDavomatStatus(): Promise<{ enabled: boolean; url: string }>
  syncDavomatBranches(): Promise<DavomatSyncResult>
  getDavomatEmployees(): Promise<DavomatEmployeeView[]>
  importDavomatEmployees(codes: string[]): Promise<DavomatImportResult>
  /** Davomat bo'yicha hali kelmagan ustozlar (enabled=false — funksiya o'chiq yoki davomat ulanmagan) */
  getAttendanceMissing(date: string): Promise<{ enabled: boolean; items: AttendanceMissing[] }>
  /** Kelmagan ustoz uchun arizani ochish -> o'rinbosar qidiriladi */
  openAbsenceForMissing(teacherId: string, date: string): Promise<{ casesCount: number; fullName: string }>
}
