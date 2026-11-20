// Mas'ul shaxs: o'rinbosar kerak bo'lgan darslar ro'yxati
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, PartyPopper } from 'lucide-react'
import { api } from '../../api'
import { formatDate } from '../../lib/date'
import type { CoverCase } from '../../types'
import { Avatar, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, SubjectChip, cx } from '../../components/ui'

function CaseRow({ c }: { c: CoverCase }) {
  const ready = c.status === 'pending' && c.candidates.length > 0
  const hint =
    c.status === 'found'
      ? `O'rinbosar: ${c.chosenTeacher?.fullName}`
      : c.status === 'not_found'
        ? 'Hech kim qabul qilmadi'
        : ready
          ? `${c.candidates.length} ta nomzod tayyor — tanlang`
          : 'Ustozlar javobi kutilmoqda'
  return (
    <Link to={`/app/coordinator/${c.id}`} className="block transition active:scale-[0.98]">
      <Card className={cx('flex items-center gap-3 p-3.5', ready && 'ring-2 ring-brand')}>
        <Avatar name={c.absentTeacher.fullName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate font-extrabold">{c.absentTeacher.fullName}</div>
            <StatusBadge status={c.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-tg-hint">
            <SubjectChip subject={c.lesson.subject} />
            {c.lesson.className} · {c.lesson.para}-para · {formatDate(c.date).split(',')[0]}
          </div>
          <div className={cx('mt-1.5 text-xs font-bold', ready ? 'text-brand' : c.status === 'not_found' ? 'text-rose-600' : 'text-tg-hint')}>
            {hint}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-tg-hint" />
      </Card>
    </Link>
  )
}

export default function CoordinatorListPage() {
  const cases = useQuery({ queryKey: ['cases'], queryFn: api.getCases })

  if (cases.isPending) return <LoadingState />
  if (cases.isError) return <ErrorState error={cases.error} onRetry={() => cases.refetch()} />

  const open = cases.data.filter((c) => c.status !== 'found')
  const done = cases.data.filter((c) => c.status === 'found')
  const ready = open.filter((c) => c.status === 'pending' && c.candidates.length > 0).length

  return (
    <div>
      <PageHeader title="Nomzod tanlash" subtitle="O'rinbosar kerak bo'lgan darslar" />

      {ready > 0 && (
        <div className="mb-5 rounded-3xl bg-linear-to-r from-brand to-brand-strong p-4 text-white shadow-lg shadow-brand/25">
          <div className="text-2xl font-extrabold">{ready} ta dars</div>
          <div className="text-sm font-semibold text-white/85">uchun nomzodlar tayyor — sizning tanlovingiz kutilmoqda</div>
        </div>
      )}

      {cases.data.length === 0 ? (
        <Card>
          <EmptyState icon={PartyPopper} gradient="from-emerald-400 to-teal-500" title="Hammasi joyida" text="Hozircha o'rinbosar kerak bo'lgan dars yo'q." />
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold text-tg-hint uppercase">Hal qilinmagan · {open.length}</h2>
            {open.length === 0 ? <p className="text-sm text-tg-hint">Yo'q</p> : open.map((c) => <CaseRow key={c.id} c={c} />)}
          </section>
          {done.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-tg-hint uppercase">Topilganlar · {done.length}</h2>
              {done.map((c) => <CaseRow key={c.id} c={c} />)}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
