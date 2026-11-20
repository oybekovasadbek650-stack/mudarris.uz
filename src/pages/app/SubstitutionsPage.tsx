// O'rinbosar darslarim: qabul qilingan darslar ro'yxati
import { useQuery } from '@tanstack/react-query'
import { Repeat2 } from 'lucide-react'
import { api } from '../../api'
import { fromISO, MONTHS, todayISO } from '../../lib/date'
import { tintOf } from '../../lib/colors'
import type { Offer } from '../../types'
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, cx } from '../../components/ui'

function Row({ o }: { o: Offer }) {
  const d = fromISO(o.date)
  const tint = tintOf(o.lesson.subject)
  return (
    <Card className="flex items-center gap-3.5 p-3.5">
      <div className={cx('flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-md', tint.gradient)}>
        <span className="text-xl leading-none font-extrabold">{d.getDate()}</span>
        <span className="text-[10px] font-bold uppercase">{MONTHS[d.getMonth()].slice(0, 3)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-extrabold">{o.lesson.subject} · {o.lesson.className}</div>
        <div className="text-xs font-semibold text-tg-hint">
          {o.lesson.para}-para · {o.lesson.startTime}–{o.lesson.endTime} · {o.lesson.room}-xona
        </div>
        <div className="mt-1.5">
          {o.assigned ? <Badge tone="green" dot>Tasdiqlangan</Badge> : <Badge tone="amber" dot>Mas'ul tanlashini kutmoqda</Badge>}
        </div>
      </div>
    </Card>
  )
}

export default function SubstitutionsPage() {
  const subs = useQuery({ queryKey: ['substitutions'], queryFn: api.getMySubstitutions })

  if (subs.isPending) return <LoadingState />
  if (subs.isError) return <ErrorState error={subs.error} onRetry={() => subs.refetch()} />

  const today = todayISO()
  const month = today.slice(0, 7)
  const upcoming = subs.data.filter((o) => o.date >= today).reverse()
  const past = subs.data.filter((o) => o.date < today && o.assigned)
  const thisMonth = subs.data.filter((o) => o.assigned && o.date.startsWith(month)).length

  return (
    <div>
      <PageHeader title="O'rinbosar darslarim" subtitle="Siz qabul qilgan darslar" />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-linear-to-br from-emerald-400 to-teal-500 p-4 text-white shadow-lg shadow-emerald-500/25">
          <div className="text-3xl font-extrabold">{thisMonth}</div>
          <div className="text-xs font-bold text-white/85">bu oy tasdiqlangan</div>
        </div>
        <div className="rounded-3xl bg-linear-to-br from-brand to-brand-strong p-4 text-white shadow-lg shadow-brand/25">
          <div className="text-3xl font-extrabold">{upcoming.length}</div>
          <div className="text-xs font-bold text-white/85">kelgusi dars</div>
        </div>
      </div>

      {subs.data.length === 0 ? (
        <Card>
          <EmptyState icon={Repeat2} gradient="from-emerald-400 to-teal-500" title="Hali o'rinbosar darsingiz yo'q" text="Takliflarni qabul qilganingizda shu yerda ko'rinadi." />
        </Card>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-tg-hint uppercase">Kelgusi</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-tg-hint">Kelgusi o'rinbosar dars yo'q.</p>
            ) : (
              <div className="space-y-3">{upcoming.map((o) => <Row key={o.id} o={o} />)}</div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-extrabold text-tg-hint uppercase">O'tganlar</h2>
              <div className="space-y-3 opacity-75">{past.map((o) => <Row key={o.id} o={o} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
