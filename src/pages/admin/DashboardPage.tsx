// Bugungi holat: kelmaganlar va har bir dars holati, filial bo'yicha filtr
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Hourglass, MessageSquareQuote, PartyPopper, SearchX, UserX, type LucideIcon } from 'lucide-react'
import { api } from '../../api'
import { formatDate, todayISO } from '../../lib/date'
import type { CaseStatus } from '../../types'
import { Avatar, Card, EmptyState, ErrorState, IconTile, LoadingState, StatusBadge, SubjectChip, cx } from '../../components/ui'
import { AdminHeader, selectClass } from './AdminLayout'
import { useOrgBranches } from '../../lib/adminOrg'

function StatCard({ label, value, total, footer, icon, gradient, bar }: { label: string; value: number | string; total?: number; footer?: string; icon: LucideIcon; gradient: string; bar: string }) {
  const pct = typeof value === 'number' && total ? Math.round((value / total) * 100) : null
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold text-slate-500">{label}</div>
          <div className="mt-2 text-4xl font-extrabold tracking-tight">{value}</div>
        </div>
        <IconTile icon={icon} gradient={gradient} />
      </div>
      {pct !== null && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cx('h-full rounded-full transition-all duration-700', bar)} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-xs font-bold text-slate-400">darslarning {pct}%</div>
        </div>
      )}
      {footer && <div className="mt-[22px] text-xs font-bold text-slate-400">{footer}</div>}
    </Card>
  )
}

export default function DashboardPage() {
  const [date, setDate] = useState(todayISO())
  const [branchId, setBranchId] = useState('')
  const { branches, inOrg, branchName } = useOrgBranches()
  const overview = useQuery({
    queryKey: ['overview', date, branchId],
    queryFn: () => api.getDayOverview(date, branchId || undefined),
    refetchInterval: 30_000, // har 30 soniyada yangilanadi
  })

  // Tanlangan tashkilotga tegishli kelmaganlar
  const absences = overview.data?.absences.filter((a) => inOrg(a.teacher.branchId)) ?? []
  const allCases = absences.flatMap((a) => a.cases)
  const count = (s: CaseStatus) => allCases.filter((c) => c.status === s).length
  const loading = overview.isPending

  return (
    <div>
      <AdminHeader
        title="Bugungi holat"
        subtitle={formatDate(date)}
        actions={
          <>
            <input type="date" className={selectClass} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <select className={selectClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Barcha filiallar</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kelmaganlar" value={loading ? '–' : absences.length} footer={loading ? undefined : `${allCases.length} ta darsga o'rinbosar kerak`} icon={UserX} gradient="from-brand to-brand-strong" bar="bg-brand" />
        <StatCard label="Topildi" value={loading ? '–' : count('found')} total={allCases.length} icon={CheckCircle2} gradient="from-emerald-400 to-teal-500" bar="bg-emerald-500" />
        <StatCard label="Kutilmoqda" value={loading ? '–' : count('pending')} total={allCases.length} icon={Hourglass} gradient="from-amber-400 to-orange-500" bar="bg-amber-500" />
        <StatCard label="Topilmadi" value={loading ? '–' : count('not_found')} total={allCases.length} icon={SearchX} gradient="from-rose-500 to-pink-600" bar="bg-rose-500" />
      </div>

      <h2 className="mb-4 text-lg font-extrabold">Bugun kelmaydiganlar</h2>
      {overview.isPending ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : absences.length === 0 ? (
        <Card>
          <EmptyState icon={PartyPopper} gradient="from-emerald-400 to-teal-500" title="Bu kuni kelmaydigan xodim yo'q" text="Hamma mashg'ulot va darslar o'z vaqtida o'tadi." />
        </Card>
      ) : (
        <div className="grid gap-5 2xl:grid-cols-2">
          {absences.map((a) => (
            <Card key={a.id} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center gap-4 px-6 py-5">
                <Avatar name={a.teacher.fullName} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-extrabold">{a.teacher.fullName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{branchName(a.teacher.branchId)}</span>
                    {a.teacher.subjects.map((s) => <SubjectChip key={s} subject={s} />)}
                  </div>
                </div>
                <div className="flex max-w-xs items-start gap-2 rounded-2xl bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-900">
                  <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  {a.reason}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="px-6 py-3">Para</th>
                      <th className="px-4 py-3">Sinf</th>
                      <th className="px-4 py-3">Xona</th>
                      <th className="px-4 py-3">O'rinbosar</th>
                      <th className="px-6 py-3 text-right">Holat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.cases.map((c) => (
                      <tr key={c.id} className={cx('border-t border-slate-100', c.status === 'not_found' && 'bg-rose-50/70')}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/8 font-extrabold text-brand-strong">{c.lesson.para}</span>
                            <span className="font-semibold text-slate-500">{c.lesson.startTime}–{c.lesson.endTime}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-bold">{c.lesson.className}</td>
                        <td className="px-4 py-3.5 font-semibold text-slate-500">{c.lesson.room}</td>
                        <td className="px-4 py-3.5">
                          {c.chosenTeacher ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={c.chosenTeacher.fullName} size="sm" />
                              <span className="font-bold">{c.chosenTeacher.fullName}</span>
                            </div>
                          ) : c.status === 'pending' ? (
                            <span className="font-semibold text-slate-400">{c.candidates.length} ta nomzod javob berdi</span>
                          ) : (
                            <span className="font-bold text-rose-600">Hech kim yo'q</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right"><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
