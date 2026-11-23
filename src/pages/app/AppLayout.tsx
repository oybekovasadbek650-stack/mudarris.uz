// Mini App (telefon) umumiy ramkasi: suzuvchi pastki menyu + bot havolalarini qayta ishlash
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Inbox, Repeat2, UsersRound } from 'lucide-react'
import { api, USE_MOCK } from '../../api'
import { initTelegram, isInTelegram, startParam } from '../../lib/telegram'
import { useApplyOrg } from '../../lib/org'

let startParamHandled = false

export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const me = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useApplyOrg(me.data?.org)
  const offers = useQuery({ queryKey: ['offers'], queryFn: api.getMyOffers })
  const newOffers = offers.data?.filter((o) => o.status === 'pending').length ?? 0

  useEffect(() => {
    initTelegram()
    // Bot xabaridagi tugma aniq sahifani ochishi uchun:
    //   startapp=offers     -> Takliflar
    //   startapp=case_c123  -> Mas'ul shaxs uchun nomzod tanlash
    //   startapp=absence    -> "Kela olmayman"
    //   startapp=cases      -> Mas'ul shaxs: holatlar ro'yxati
    //   startapp=substitutions -> O'rinbosar darslarim
    // t.me havolasi bo'lmasa (bot web_app tugmasi), parametr URL'da keladi: /app?startapp=...
    if (startParamHandled) return
    startParamHandled = true
    const p = startParam() ?? new URLSearchParams(window.location.search).get('startapp')
    if (!p) return
    if (p === 'offers' || p.startsWith('offer_')) navigate('/app/offers', { replace: true })
    else if (p.startsWith('case_')) navigate(`/app/coordinator/${p.slice(5)}`, { replace: true })
    else if (p === 'cases') navigate('/app/coordinator', { replace: true })
    else if (p === 'substitutions') navigate('/app/substitutions', { replace: true })
    else if (p === 'absence') navigate('/app/absence', { replace: true })
  }, [navigate])

  // Sahifa almashganda tepaga qaytish
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const tabs = [
    { to: '/app', label: 'Bugun', icon: CalendarDays, end: true },
    { to: '/app/offers', label: 'Takliflar', icon: Inbox, badge: newOffers },
    { to: '/app/substitutions', label: "O'rinbosar", icon: Repeat2 },
    ...(me.data?.isCoordinator ? [{ to: '/app/coordinator', label: 'Nomzodlar', icon: UsersRound }] : []),
  ]

  return (
    <div className="min-h-dvh bg-tg-secondary font-sans text-tg-text">
      {USE_MOCK && !isInTelegram && (
        <div className="flex justify-center pt-3">
          <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-bold text-amber-800">
            Demo · {me.data?.fullName ?? '...'}
          </span>
        </div>
      )}
      <main key={pathname} className="mx-auto max-w-md animate-fade-up px-4 pt-4 pb-32">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        <div className="mx-auto flex max-w-md gap-1 rounded-[28px] bg-tg-bg/90 p-1.5 shadow-[0_10px_40px_-10px_rgba(30,58,138,0.35)] ring-1 ring-slate-900/5 backdrop-blur-xl">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center gap-0.5 rounded-3xl py-2 text-[11px] font-bold transition ${
                  isActive
                    ? 'bg-linear-to-br from-brand to-brand-strong text-white shadow-lg shadow-brand/30'
                    : 'text-tg-hint hover:text-tg-text'
                }`
              }
            >
              <t.icon className="h-5.5 w-5.5" strokeWidth={2.2} />
              {t.label}
              {Boolean(t.badge) && (
                <span className="absolute top-1 right-[calc(50%-22px)] flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-tg-bg">
                  {t.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
