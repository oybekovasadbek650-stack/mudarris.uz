import { Link, Route, Routes } from 'react-router-dom'
import AppLayout from './pages/app/AppLayout'
import TodayPage from './pages/app/TodayPage'
import AbsencePage from './pages/app/AbsencePage'
import OffersPage from './pages/app/OffersPage'
import SubstitutionsPage from './pages/app/SubstitutionsPage'
import CoordinatorListPage from './pages/app/CoordinatorListPage'
import CoordinatorCasePage from './pages/app/CoordinatorCasePage'
import AdminLayout from './pages/admin/AdminLayout'
import DashboardPage from './pages/admin/DashboardPage'
import SchedulePage from './pages/admin/SchedulePage'
import TeachersPage from './pages/admin/TeachersPage'
import SettingsPage from './pages/admin/SettingsPage'
import ReportPage from './pages/admin/ReportPage'
import { ChevronRight, MapPinOff, MonitorSmartphone, Smartphone } from 'lucide-react'
import { OrgLogoStack } from './components/OrgLogo'
import { useApplyOrg } from './lib/org'
import { EmptyState } from './components/ui'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import AdminLoginPage from './pages/auth/AdminLoginPage'

/** Bosh sahifa — ishlab chiqish paytida ikki qismga tez o'tish uchun */
function Home() {
  useApplyOrg(undefined)
  const items = [
    { to: '/app', icon: Smartphone, title: 'Mini App', text: "O'qituvchi va mas'ul shaxs uchun · telefon, Telegram ichida", gradient: 'from-brand to-brand-strong' },
    { to: '/admin', icon: MonitorSmartphone, title: 'Rahbariyat paneli', text: "Bugungi holat, jadval, o'qituvchilar, hisobot · kompyuter", gradient: 'from-violet-500 to-fuchsia-500' },
  ]
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-linear-to-br from-brand-dark via-brand-dark to-brand-strong p-4 font-sans">
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand/35 blur-3xl" />
      <div className="absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-brand-accent/25 blur-3xl" />
      <div className="relative w-full max-w-md space-y-4">
        <div className="mb-8 text-center text-white">
          <div className="mb-5 flex justify-center">
            <OrgLogoStack className="h-16 w-16" />
          </div>
          <h1 className="text-3xl font-extrabold">Mudarris · O'rinbosar</h1>
          <p className="mt-1 text-sm font-semibold text-white/60">Bog'cha, maktab va akademiya uchun</p>
        </div>
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="group flex items-center gap-4 rounded-3xl bg-white/10 p-5 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${it.gradient} shadow-lg`}>
              <it.icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-extrabold">{it.title}</div>
              <div className="text-sm text-white/65">{it.text}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/60 transition group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/app" element={<RequireAuth role="teacher"><AppLayout /></RequireAuth>}>
        <Route index element={<TodayPage />} />
        <Route path="absence" element={<AbsencePage />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="substitutions" element={<SubstitutionsPage />} />
        <Route path="coordinator" element={<CoordinatorListPage />} />
        <Route path="coordinator/:caseId" element={<CoordinatorCasePage />} />
      </Route>
      <Route path="/admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="report" element={<ReportPage />} />
      </Route>
      <Route path="*" element={<EmptyState icon={MapPinOff} title="Sahifa topilmadi" action={<Link to="/" className="text-brand">Bosh sahifaga</Link>} />} />
    </Routes>
  )
}
