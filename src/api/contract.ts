// API shartnomasi: frontend backenddan nimalarni kutadi.
// mock.ts ham, http.ts ham aynan shu interfeysni bajaradi.
import type {
  Branch,
  CoverCase,
  Lesson,
  Me,
  MonthlyReportRow,
  Offer,
  Settings,
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
    cases: CoverCase[]
  }[]
}

export interface ScheduleImportResult {
  imported: number
  errors: string[]
}

/** Admin tahrirlay oladigan maydonlar (login/parolni o'qituvchining o'zi boshqaradi) */
export type TeacherInput = Pick<Teacher, 'id' | 'fullName' | 'phone' | 'subjects' | 'branchId' | 'isCoordinator'>

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

export interface Api {
  // --- Kirish / ro'yxatdan o'tish (token talab qilinmaydi) ---
  login(login: string, password: string): Promise<LoginResult>
  register(input: RegisterInput): Promise<{ status: 'pending' }>
  getBranches(): Promise<Branch[]>

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
  getSchedule(branchId: string): Promise<Lesson[]>
  importSchedule(file: File): Promise<ScheduleImportResult>
  getTeachers(): Promise<Teacher[]>
  saveTeacher(input: TeacherInput): Promise<Teacher>
  approveTeacher(id: string): Promise<Teacher>
  rejectTeacher(id: string): Promise<Teacher>
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>
  getMonthlyReport(month: string): Promise<MonthlyReportRow[]>
}
