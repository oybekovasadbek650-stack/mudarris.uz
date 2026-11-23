// Takliflar: boshqa ustoz o'rniga darsga kirish so'rovlari
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Inbox, Timer, X } from 'lucide-react'
import { api } from '../../api'
import { formatDate } from '../../lib/date'
import { tintOf } from '../../lib/colors'
import { haptic } from '../../lib/telegram'
import type { Offer } from '../../types'
import { Alert, Badge, Button, Card, EmptyState, ErrorState, LessonInfo, LoadingState, PageHeader, cx } from '../../components/ui'

/** Javob berish muddati: "14:35 gacha · 12 daqiqa qoldi" */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function Deadline({ iso }: { iso: string }) {
  const now = useNow(15_000)
  const end = new Date(iso)
  const left = Math.max(0, Math.ceil((end.getTime() - now) / 60_000))
  const time = end.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <div className={cx('flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold', left <= 5 ? 'bg-rose-500/10 text-rose-700' : 'bg-amber-400/15 text-amber-900')}>
      <Timer className="h-4 w-4 shrink-0" />
      <span>
        <b>{time}</b> gacha javob bering · {left > 0 ? `${left} daqiqa qoldi` : "muddat tugadi"}
      </span>
    </div>
  )
}

function OfferCard({ offer }: { offer: Offer }) {
  const qc = useQueryClient()
  const respond = useMutation({
    mutationFn: (accept: boolean) => api.respondOffer(offer.id, accept),
    onSuccess: (_, accept) => {
      haptic(accept ? 'success' : 'warning')
      qc.invalidateQueries({ queryKey: ['offers'] })
      qc.invalidateQueries({ queryKey: ['substitutions'] })
    },
    onError: () => haptic('error'),
  })
  const l = offer.lesson
  const tint = tintOf(l.subject)

  return (
    <Card className="overflow-hidden p-0">
      <div className={cx('relative bg-linear-to-br px-4 py-3.5 text-white', tint.gradient)}>
        <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/15" />
        <div className="relative flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-white/80">{formatDate(offer.date)}</div>
            <div className="text-lg font-extrabold">{l.subject} · {l.className}</div>
          </div>
          <span className="rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-extrabold backdrop-blur">YANGI</span>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm">
          <span className="font-extrabold">{offer.absentTeacherName}</span>
          <span className="text-tg-hint"> kela olmaydi. O'rniga kira olasizmi?</span>
        </p>
        <LessonInfo para={l.para} time={`${l.startTime}–${l.endTime}`} className={l.className} subject={l.subject} room={l.room} />
        {offer.expiresAt && <Deadline iso={offer.expiresAt} />}
        {respond.isError && <Alert>{(respond.error as Error).message}</Alert>}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="secondary"
            icon={X}
            disabled={respond.isPending}
            loading={respond.isPending && respond.variables === false}
            onClick={() => respond.mutate(false)}
          >
            Rad etaman
          </Button>
          <Button
            variant="success"
            icon={Check}
            disabled={respond.isPending}
            loading={respond.isPending && respond.variables === true}
            onClick={() => respond.mutate(true)}
          >
            Qabul qilaman
          </Button>
        </div>
      </div>
    </Card>
  )
}

function answeredLabel(o: Offer) {
  if (o.status === 'accepted') return o.assigned ? { text: 'Siz tanlandingiz', tone: 'green' as const } : { text: 'Qabul qilindi', tone: 'blue' as const }
  if (o.status === 'rejected') return { text: 'Rad etildi', tone: 'red' as const }
  // expired: javob muddati o'tgan yoki mas'ul boshqa ustozni tanlagan
  return { text: 'Taklif yopildi', tone: 'gray' as const }
}

export default function OffersPage() {
  // Har 30 soniyada yangilanadi: qolgan daqiqalar va muddati o'tgan takliflar
  const offers = useQuery({ queryKey: ['offers'], queryFn: api.getMyOffers, refetchInterval: 30_000 })

  if (offers.isPending) return <LoadingState />
  if (offers.isError) return <ErrorState error={offers.error} onRetry={() => offers.refetch()} />

  const pending = offers.data.filter((o) => o.status === 'pending')
  const answered = offers.data.filter((o) => o.status !== 'pending')

  return (
    <div>
      <PageHeader
        title="Takliflar"
        subtitle="Boshqa ustoz o'rniga darsga kirish"
        right={pending.length > 0 && <Badge tone="red">{pending.length} ta yangi</Badge>}
      />
      {pending.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title="Yangi taklif yo'q" text="Kimdir o'rniga dars kerak bo'lsa, bot sizga darhol xabar yuboradi." />
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      )}

      {answered.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 text-sm font-extrabold text-tg-hint uppercase">Javob berilganlar</h2>
          <Card className="divide-y divide-slate-500/10 p-0">
            {answered.map((o) => {
              const s = answeredLabel(o)
              return (
                <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cx('h-9 w-1.5 rounded-full', tintOf(o.lesson.subject).bar)} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-bold">{formatDate(o.date)} · {o.lesson.para}-para</div>
                    <div className="text-xs font-semibold text-tg-hint">{o.lesson.subject} · {o.lesson.className}</div>
                  </div>
                  <Badge tone={s.tone} dot>{s.text}</Badge>
                </div>
              )
            })}
          </Card>
        </section>
      )}
    </div>
  )
}
