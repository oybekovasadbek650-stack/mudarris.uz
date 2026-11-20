// O'qituvchi bosh sahifasi: bugungi darslar, "Kela olmayman", yangi takliflar soni
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, CalendarX2, ChevronRight, DoorOpen, LogOut, Sun } from 'lucide-react'
import { clearToken } from '../../lib/auth'
import { ORGS } from '../../lib/org'
import { OrgLogo } from '../../components/OrgLogo'
import { api } from '../../api'
import { formatDate, todayISO } from '../../lib/date'
import { tintOf } from '../../lib/colors'
import type { Lesson } from '../../types'
import { Card, EmptyState, ErrorState, LoadingState, cx } from '../../components/ui'

const nowHM = () => new Date().toTimeString().slice(0, 5)

function LessonTimeline({ lessons }: { lessons: Lesson[] }) {
  const now = nowHM()
  const nextId = lessons.find((l) => l.startTime > now)?.id
  return (
    <div className="space-y-3">
      {lessons.map((l, i) => {
        const tint = tintOf(l.subject)
        const live = l.startTime <= now && now < l.endTime
        const done = l.endTime <= now
        return (
          <div key={l.id} className={cx('flex gap-3', done && 'opacity-55')}>
            <div className="w-12 shrink-0 pt-3 text-right">
              <div className="text-sm font-extrabold">{l.startTime}</div>
              <div className="text-[11px] font-semibold text-tg-hint">{l.endTime}</div>
            </div>
            <div className="relative flex flex-col items-center">
              <span className={cx('mt-4 h-3 w-3 rounded-full ring-4 ring-tg-secondary', live ? 'bg-rose-500' : tint.bar)} />
              {i < lessons.length - 1 && <span className="mt-1 w-0.5 flex-1 rounded-full bg-slate-400/25" />}
            </div>
            <Card className={cx('relative flex-1 overflow-hidden p-3.5 pl-4', live && 'ring-2 ring-rose-400')}>
              <span className={cx('absolute inset-y-0 left-0 w-1.5', tint.bar)} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-extrabold">{l.subject}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-tg-hint">
                    <span className={cx('rounded-lg px-2 py-0.5 font-bold', tint.soft)}>{l.className}</span>
                    <span className="inline-flex items-center gap-1">
                      <DoorOpen className="h-3.5 w-3.5" /> {l.room}-xona
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] font-bold text-tg-hint">{l.para}-para</span>
                  {live && <span className="animate-pulse rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">HOZIR</span>}
                  {l.id === nextId && !live && <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-extrabold text-brand-strong">KEYINGI</span>}
                </div>
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}

export default function TodayPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const logout = () => {
    clearToken()
    qc.clear()
    navigate('/login', { replace: true })
  }
  const today = todayISO()
  const me = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  const lessons = useQuery({ queryKey: ['my-lessons', today], queryFn: () => api.getMyLessons(today) })
  const offers = useQuery({ queryKey: ['offers'], queryFn: api.getMyOffers })
  const newOffers = offers.data?.filter((o) => o.status === 'pending').length ?? 0
  const org = ORGS[me.data?.org ?? 'school']
  const firstName = me.data?.fullName.split(' ')[0]

  return (
    <div className="space-y-5">
      {/* Salomlashish */}
      <div className="relative overflow-hidden rounded-[32px] bg-linear-to-br from-brand via-brand to-brand-strong p-5 text-white shadow-xl shadow-brand/30">
        <div className="absolute -top-10 -right-8 h-36 w-36 rounded-full bg-white/15 blur-sm" />
        <div className="absolute -bottom-14 left-10 h-32 w-32 rounded-full bg-brand-accent/40 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <OrgLogo org={org.id} className="h-10 w-10 rounded-xl" />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-extrabold">{org.name}</div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-white/75">
                  <Sun className="h-3 w-3" /> {formatDate(today)}
                </div>
              </div>
            </div>
            <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur hover:bg-white/25">
              <LogOut className="h-3.5 w-3.5" /> Chiqish
            </button>
          </div>
          <h1 className="mt-4 text-[26px] leading-tight font-extrabold">
            Assalomu alaykum{firstName ? `, ${firstName}` : ''}!
          </h1>
          <div className="mt-4 flex gap-2">
            <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
              <div className="text-2xl font-extrabold">{lessons.data?.length ?? '–'}</div>
              <div className="text-xs font-semibold text-white/80">bugungi {org.lesson}</div>
            </div>
            <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
              <div className="text-2xl font-extrabold">{offers.data ? newOffers : '–'}</div>
              <div className="text-xs font-semibold text-white/80">yangi taklif</div>
            </div>
          </div>
        </div>
      </div>

      {/* Kela olmayman */}
      <Link
        to="/app/absence"
        className="group flex items-center gap-4 rounded-[28px] bg-linear-to-r from-rose-500 to-pink-600 p-4 text-white shadow-xl shadow-rose-500/30 transition active:scale-[0.98]"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <CalendarX2 className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <div className="text-lg font-extrabold">Kela olmayman</div>
          <div className="text-sm text-white/85">O'rningizga o'rinbosar topamiz</div>
        </div>
        <ChevronRight className="h-6 w-6 transition group-hover:translate-x-1" />
      </Link>

      {/* Yangi takliflar */}
      {newOffers > 0 && (
        <Link
          to="/app/offers"
          className="flex animate-fade-up items-center gap-3 rounded-3xl bg-linear-to-r from-amber-400 to-orange-500 p-4 text-white shadow-lg shadow-orange-500/25"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/25">
            <BellRing className="h-5 w-5" />
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-extrabold text-orange-600">
              {newOffers}
            </span>
          </div>
          <div className="flex-1">
            <div className="font-extrabold">{newOffers} ta yangi taklif</div>
            <div className="text-xs font-medium text-white/90">Boshqa ustoz o'rniga darsga kira olasizmi?</div>
          </div>
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}

      {/* Bugungi darslar */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold">Bugungi {org.lesson}larim</h2>
        {lessons.isPending ? (
          <LoadingState />
        ) : lessons.isError ? (
          <ErrorState error={lessons.error} onRetry={() => lessons.refetch()} />
        ) : lessons.data.length === 0 ? (
          <Card>
            <EmptyState icon={Sun} gradient="from-amber-400 to-orange-500" title="Bugun darsingiz yo'q" text="Dam oling yoki takliflarni ko'rib chiqing." />
          </Card>
        ) : (
          <LessonTimeline lessons={lessons.data} />
        )}
      </section>
    </div>
  )
}
