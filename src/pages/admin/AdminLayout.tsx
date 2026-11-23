// Panel umumiy ramkasi: to'q rangli chap menyu.
// Umumiy rahbariyat — hamma tashkilot/filial; filial direktori — faqat o'z filiali (tashkilot tanlovi yo'q).
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarRange, FlaskConical, LayoutDashboard, LogOut, ScanFace, Send, Settings2, TrendingUp, UsersRound } from 'lucide-react'
import { api, USE_MOCK } from '../../api'
import { clearToken } from '../../lib/auth'
import { resetMockDb } from '../../api/mock'
import { AdminOrgContext, readOrgPref, usePanelUser, writeOrgPref, type OrgFilter } from '../../lib/adminOrg'
import { ORG_LIST, ORGS, useApplyOrg } from '../../lib/org'
import { OrgLogo, MudarrisLogo } from '../../components/OrgLogo'
import { InstallAppButton } from '../../components/InstallApp'
import { cx } from '../../components/ui'

const links = [
  { to: '/admin', label: 'Bugungi holat', icon: LayoutDashboard, end: true },
  { to: '/admin/schedule', label: 'Dars jadvali', icon: CalendarRange },
  { to: '/admin/teachers', label: "O'qituvchilar", icon: UsersRound },
  { to: '/admin/report', label: 'Oylik hisobot', icon: TrendingUp },
  { to: '/admin/branches', label: 'Filiallar', icon: Building2, adminOnly: true },
  { to: '/admin/davomat', label: 'Davomatdan olish', icon: ScanFace },
  { to: '/admin/settings', label: 'Sozlamalar', icon: Settings2 },
]

/** Direktor uchun: Telegram'ni bog'lash (bot orqali tasdiqlash so'rovlari keladi) */
function TelegramLinkButton({ linked }: { linked: boolean }) {
  const qc = useQueryClient()
  const link = useMutation({
    mutationFn: api.getTelegramLink,
    onSuccess: ({ url }) => {
      window.open(url, '_blank', 'noopener')
      // Foydalanuvchi botda /start bosganidan keyin holat yangilansin
      setTimeout(() => qc.invalidateQueries({ queryKey: ['me'] }), 15_000)
    },
  })
  if (linked) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-200">
        <Send className="h-3.5 w-3.5" /> Telegram ulangan
      </div>
    )
  }
  return (
    <div>
      <button
        onClick={() => link.mutate()}
        disabled={link.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-extrabold text-white shadow-md shadow-sky-500/30 transition hover:bg-sky-400 disabled:opacity-60"
      >
        <Send className="h-3.5 w-3.5" /> Telegram'ni ulash
      </button>
      {link.isError && <div className="mt-1.5 text-[11px] font-semibold text-rose-200">{(link.error as Error).message}</div>}
      {link.isSuccess && (
        <div className="mt-1.5 text-[11px] font-semibold text-white/60">
          Botda «Start» ni bosing. Havola {link.data.expiresInMinutes} daqiqa amal qiladi.
        </div>
      )}
    </div>
  )
}

export default function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { me, isDirector } = usePanelUser()
  const [orgPref, setOrgState] = useState<OrgFilter>(readOrgPref)
  const setOrg = (o: OrgFilter) => {
    setOrgState(o)
    writeOrgPref(o)
  }
  // Direktor uchun tashkilot — uning filiali tashkiloti (tanlov yo'q)
  const org: OrgFilter = isDirector && me?.org ? me.org : orgPref
  useApplyOrg(org === 'all' ? undefined : org)

  const teachers = useQuery({ queryKey: ['teachers'], queryFn: api.getTeachers })
  const branches = useQuery({ queryKey: ['branches'], queryFn: api.getBranches })
  const orgOfBranch = (id: string) => branches.data?.find((b) => b.id === id)?.org
  const branchName = branches.data?.find((b) => b.id === me?.branchId)?.name ?? ''
  const pending = teachers.data?.filter((t) => t.status === 'pending' && (org === 'all' || orgOfBranch(t.branchId) === org)).length ?? 0
  // Botdan kelgan direktorlik arizalari — faqat umumiy rahbariyat
  const dirRequests = useQuery({ queryKey: ['director-requests'], queryFn: api.getDirectorRequests, enabled: Boolean(me) && !isDirector })
  const dirPending = dirRequests.data?.length ?? 0
  const staffLabel = org === 'all' ? 'Xodimlar' : ORGS[org].staffPlural
  const visibleLinks = links.filter((l) => !(l.adminOnly && isDirector))
  const logout = () => {
    clearToken()
    qc.clear()
    navigate('/admin/login', { replace: true })
  }
  const title = isDirector ? branchName || 'Filial' : org === 'all' ? 'Mudarris' : ORGS[org].name
  const subtitle = isDirector ? 'Direktor paneli' : "O'rinbosar · Rahbariyat paneli"

  return (
    <AdminOrgContext.Provider value={{ org, setOrg }}>
    <div className="min-h-dvh bg-app font-sans text-slate-900 lg:flex">
      <aside className="relative overflow-hidden bg-linear-to-b from-brand-dark via-brand-dark to-brand-strong text-white lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:shrink-0 lg:overflow-y-auto">
        <div className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full bg-brand/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-10 hidden h-64 w-64 rounded-full bg-brand-accent/25 blur-3xl lg:block" />

        <div className="relative flex items-center gap-3 px-6 pt-6 pb-4">
          {org === 'all' ? <MudarrisLogo className="h-12 w-12" /> : <OrgLogo org={org} className="h-12 w-12" />}
          <div className="min-w-0">
            <div className="truncate text-base leading-tight font-extrabold">{title}</div>
            <div className="text-xs font-semibold text-white/55">{subtitle}</div>
          </div>
        </div>

        {/* Tashkilot tanlash — faqat umumiy rahbariyat uchun */}
        {!isDirector && (
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
                  <MudarrisLogo className="h-7 w-7 rounded-lg shadow-none" />
                ) : (
                  <OrgLogo org={o.id} className="h-7 w-7 rounded-lg shadow-none" />
                )}
                {o.short}
              </button>
            ))}
          </div>
        )}

        <nav className="relative flex flex-wrap gap-1 px-4 pb-4 lg:flex-col lg:flex-nowrap">
          {visibleLinks.map((l) => (
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
                  {l.to === '/admin/branches' && dirPending > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-extrabold text-white">{dirPending}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="relative mx-4 mb-4 space-y-3 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-extrabold">
              {(me?.fullName ?? 'R').slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{me?.fullName ?? 'Rahbariyat'}</div>
              <div className="text-[11px] font-semibold text-white/50">{isDirector ? 'Filial direktori' : 'Umumiy rahbariyat'}</div>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" /> Chiqish
            </button>
          </div>
          {isDirector && <TelegramLinkButton linked={Boolean(me?.telegramLinked)} />}
          <InstallAppButton />
        </div>

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
