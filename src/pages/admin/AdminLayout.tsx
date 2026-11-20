// Rahbariyat paneli (kompyuter) umumiy ramkasi: to'q rangli chap menyu
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, FlaskConical, LayoutDashboard, LogOut, Settings2, TrendingUp, UsersRound } from 'lucide-react'
import { api, USE_MOCK } from '../../api'
import { clearToken } from '../../lib/auth'
import { resetMockDb } from '../../api/mock'
import { AdminOrgContext, readOrgPref, writeOrgPref, type OrgFilter } from '../../lib/adminOrg'
import { ORG_LIST, ORGS, useApplyOrg } from '../../lib/org'
import { OrgLogo, OrgLogoStack } from '../../components/OrgLogo'
import { cx } from '../../components/ui'

const links = [
  { to: '/admin', label: 'Bugungi holat', icon: LayoutDashboard, end: true },
  { to: '/admin/schedule', label: 'Dars jadvali', icon: CalendarRange },
  { to: '/admin/teachers', label: "O'qituvchilar", icon: UsersRound },
  { to: '/admin/report', label: 'Oylik hisobot', icon: TrendingUp },
  { to: '/admin/settings', label: 'Sozlamalar', icon: Settings2 },
]

export default function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [org, setOrgState] = useState<OrgFilter>(readOrgPref)
  const setOrg = (o: OrgFilter) => {
    setOrgState(o)
    writeOrgPref(o)
  }
  useApplyOrg(org === 'all' ? undefined : org)

  const teachers = useQuery({ queryKey: ['teachers'], queryFn: api.getTeachers })
  const branches = useQuery({ queryKey: ['branches'], queryFn: api.getBranches })
  const orgOfBranch = (id: string) => branches.data?.find((b) => b.id === id)?.org
  const pending = teachers.data?.filter((t) => t.status === 'pending' && (org === 'all' || orgOfBranch(t.branchId) === org)).length ?? 0
  const staffLabel = org === 'all' ? "Xodimlar" : ORGS[org].staffPlural
  const logout = () => {
    clearToken()
    qc.clear()
    navigate('/admin/login', { replace: true })
  }
  return (
    <AdminOrgContext.Provider value={{ org, setOrg }}>
    <div className="min-h-dvh bg-app font-sans text-slate-900 lg:flex">
      <aside className="relative overflow-hidden bg-linear-to-b from-brand-dark via-brand-dark to-brand-strong text-white lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:shrink-0">
        <div className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full bg-brand/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-10 hidden h-64 w-64 rounded-full bg-brand-accent/25 blur-3xl lg:block" />

        <div className="relative flex items-center gap-3 px-6 pt-6 pb-4">
          {org === 'all' ? <OrgLogoStack className="h-10 w-10" /> : <OrgLogo org={org} className="h-12 w-12" />}
          <div className="min-w-0">
            <div className="truncate text-base leading-tight font-extrabold">{org === 'all' ? 'Mudarris' : ORGS[org].name}</div>
            <div className="text-xs font-semibold text-white/55">O'rinbosar · Rahbariyat paneli</div>
          </div>
        </div>

        {/* Tashkilot tanlash */}
        <div className="relative mx-4 mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-black/20 p-1 ring-1 ring-white/10">
          {([{ id: 'all' as const, short: 'Hammasi' }, ...ORG_LIST]).map((o) => (
            <button
              key={o.id}
              onClick={() => setOrg(o.id)}
              title={o.id === 'all' ? 'Barcha tashkilotlar' : ORGS[o.id].name}
              className={cx(
                'flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-extrabold transition',
                org === o.id ? 'bg-white text-brand-dark shadow-md' : 'text-white/60 hover:bg-white/10 hover:text-white',
              )}
            >
              {o.id === 'all' ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-[11px]">M</span>
              ) : (
                <OrgLogo org={o.id} className="h-7 w-7 rounded-lg shadow-none" />
              )}
              {o.short}
            </button>
          ))}
        </div>

        <nav className="relative flex gap-1 overflow-x-auto px-4 pb-4 lg:flex-col lg:overflow-visible">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `group flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold whitespace-nowrap transition ${
                  isActive ? 'bg-white text-brand-dark shadow-lg shadow-black/20' : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                      isActive ? 'bg-linear-to-br from-brand to-brand-strong text-white' : 'bg-white/10'
                    }`}
                  >
                    <l.icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </span>
                  <span className="flex-1">{l.to === '/admin/teachers' ? staffLabel : l.label}</span>
                  {l.to === '/admin/teachers' && pending > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-extrabold text-white">{pending}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="relative mx-4 mb-4 hidden items-center gap-3 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10 lg:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-extrabold">R</div>
          <div className="flex-1 text-sm font-bold">Rahbariyat</div>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
        <button onClick={logout} className="relative mx-4 mb-3 flex items-center gap-2 text-xs font-bold text-white/70 lg:hidden">
          <LogOut className="h-4 w-4" /> Chiqish
        </button>

        {USE_MOCK && (
          <div className="relative mx-4 mb-4 hidden gap-3 rounded-2xl bg-white/8 p-4 text-xs text-white/70 ring-1 ring-white/10 lg:flex">
            <FlaskConical className="h-4 w-4 shrink-0 text-amber-300" />
            <span>
              <b className="text-white">Demo rejim.</b> Soxta ma'lumotlar, barcha oynalarda umumiy.
              <button onClick={resetMockDb} className="mt-2 block font-bold text-amber-300 hover:text-amber-200">
                Boshlang'ich holatga qaytarish
              </button>
            </span>
          </div>
        )}
      </aside>

      <main key={pathname + org} className="min-w-0 flex-1 animate-fade-up p-4 sm:p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
    </AdminOrgContext.Provider>
  )
}

export function AdminHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export const selectClass =
  'rounded-2xl border-0 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-slate-200 outline-none transition focus:ring-2 focus:ring-brand'
