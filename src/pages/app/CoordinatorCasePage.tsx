// Mas'ul shaxs: bitta dars uchun 3 nomzoddan birini tanlash
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Hourglass, MessageSquareQuote, SearchX, Sparkles, UserCheck } from 'lucide-react'
import { api } from '../../api'
import { formatDate } from '../../lib/date'
import { haptic } from '../../lib/telegram'
import { Alert, Avatar, Badge, Button, Card, EmptyState, ErrorState, LessonInfo, LoadingState, PageHeader, StatusBadge, cx } from '../../components/ui'

export default function CoordinatorCasePage() {
  const { caseId = '' } = useParams()
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['case', caseId], queryFn: () => api.getCase(caseId) })

  const choose = useMutation({
    mutationFn: (teacherId: string) => api.chooseCandidate(caseId, teacherId),
    onSuccess: (data) => {
      haptic('success')
      qc.setQueryData(['case', caseId], data)
      qc.invalidateQueries({ queryKey: ['cases'] })
    },
    onError: () => haptic('error'),
  })

  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  const c = query.data
  const l = c.lesson

  return (
    <div className="space-y-4">
      <PageHeader title="Nomzod tanlash" subtitle={formatDate(c.date)} back="/app/coordinator" />

      {/* Kelmagan ustoz va dars */}
      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar name={c.absentTeacher.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-rose-500 uppercase">Kela olmaydi</div>
            <div className="truncate text-lg font-extrabold">{c.absentTeacher.fullName}</div>
          </div>
          <StatusBadge status={c.status} />
        </div>
        <LessonInfo para={l.para} time={`${l.startTime}–${l.endTime}`} className={l.className} subject={l.subject} room={l.room} />
        <div className="flex gap-2.5 rounded-2xl bg-violet-500/8 px-3.5 py-3 text-sm">
          <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <span className="font-medium">{c.reason}</span>
        </div>
      </Card>

      {choose.isError && <Alert>{(choose.error as Error).message}</Alert>}

      {c.status === 'found' ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            gradient="from-emerald-400 to-teal-500"
            title="O'rinbosar tanlandi!"
            text={`${c.chosenTeacher?.fullName} darsga kiradi. Unga bot orqali xabar yuborildi.`}
          />
        </Card>
      ) : c.status === 'not_found' ? (
        <Card className="ring-2 ring-rose-400/60">
          <EmptyState
            icon={SearchX}
            gradient="from-rose-500 to-pink-600"
            title="Nomzod topilmadi"
            text="Bo'sh ustozlarning hech biri taklifni qabul qilmadi yoki o'sha parada bo'sh ustoz yo'q. Rahbariyat paneliga xabar tushdi."
          />
          <div className="space-y-2 rounded-2xl bg-rose-500/8 p-4 text-sm">
            <div className="font-extrabold text-rose-700">Nima qilish mumkin:</div>
            {['Darsni boshqa paraga ko\'chirish', 'Sinfni boshqa sinf bilan birlashtirish', 'Rahbariyat bilan bog\'lanish'].map((t) => (
              <div key={t} className="flex items-center gap-2 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {t}
              </div>
            ))}
          </div>
        </Card>
      ) : c.candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Hourglass}
            gradient="from-amber-400 to-orange-500"
            title="Javoblar kutilmoqda"
            text="Bo'sh ustozlarga taklif yuborildi. Kimdir qabul qilishi bilan shu yerda nomzod paydo bo'ladi."
          />
        </Card>
      ) : (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-tg-hint uppercase">
            <Sparkles className="h-4 w-4 text-amber-500" /> Nomzodlar · {c.candidates.length}
          </h2>
          {c.candidates.map((cand, i) => (
            <Card key={cand.teacherId} className={cx('space-y-3', i === 0 && 'ring-2 ring-brand')}>
              <div className="flex items-center gap-3">
                <Avatar name={cand.fullName} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-extrabold">{cand.fullName}</div>
                  <div className="text-xs font-semibold text-tg-hint">{cand.subjects.join(', ')}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {i === 0 && <Badge tone="blue">Tavsiya</Badge>}
                  {cand.sameSubject && <Badge tone="green">Fani mos</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-slate-500/6 py-2">
                  <div className="text-lg font-extrabold">{cand.lessonsThatDay}</div>
                  <div className="text-[11px] font-semibold text-tg-hint">o'sha kuni darsi</div>
                </div>
                <div className="rounded-2xl bg-slate-500/6 py-2">
                  <div className="text-lg font-extrabold">{cand.substitutionsThisMonth}</div>
                  <div className="text-[11px] font-semibold text-tg-hint">bu oy o'rinbosar</div>
                </div>
              </div>
              <Button
                className="w-full"
                icon={UserCheck}
                variant={i === 0 ? 'primary' : 'secondary'}
                disabled={choose.isPending}
                loading={choose.isPending && choose.variables === cand.teacherId}
                onClick={() => choose.mutate(cand.teacherId)}
              >
                Tanlash
              </Button>
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
