// Bugungi holat: kelmaganlar va har bir dars holati, filial bo'yicha filtr
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck2, CalendarClock, CheckCircle2, Hourglass, MessageSquareQuote, PartyPopper, ScanFace, SearchX, UserCheck, UserX, type LucideIcon } from 'lucide-react'
import { api } from '../../api'
import { WEEKDAYS_SHORT, formatDate, fromISO, todayISO, weekdayOf } from '../../lib/date'
import type { CaseStatus } from '../../types'
import { Avatar, Badge, Button, Card, ErrorState, IconTile, LoadingState, StatusBadge, SubjectChip, cx } from '../../components/ui'
import { AdminHeader } from './AdminLayout'
import { DateNav } from '../../components/Pickers'
import { useToast } from '../../lib/toast'
import { useAdminOrg, useOrgBranches } from '../../lib/adminOrg'
import { WeekChart } from '../../components/WeekChart'
import { BranchSelect } from '../../components/BranchSelect'

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

const MISSING_LABEL: Record<string, { text: string; tone: 'amber' | 'red' }> = {
  asked: { text: "Botda so'raldi — javob kutilmoqda", tone: 'amber' },
  no_answer: { text: 'Javob bermadi', tone: 'red' },
  no_telegram: { text: "Telegram ulanmagan", tone: 'red' },
}

/** Davomat bo'yicha hali kelmagan ustozlar: direktor/rahbariyat bir tugma bilan o'rinbosar qidirishni boshlaydi */
function AttendanceMissingSection({ date }: { date: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { inOrg } = useOrgBranches()
  const q = useQuery({ queryKey: ['attendance-missing', date], queryFn: () => api.getAttendanceMissing(date), refetchInterval: 30_000 })
  const open = useMutation({
    mutationFn: (teacherId: string) => api.openAbsenceForMissing(teacherId, date),
    onSuccess: (r) => toast(`${r.fullName}: ${r.casesCount} ta dars uchun o'rinbosar qidirilmoqda`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['attendance-missing'] })
      qc.invalidateQueries({ queryKey: ['overview'] })
    },
  })
  const items = q.data?.items.filter((m) => inOrg(m.branchId)) ?? []
  if (!q.data?.enabled || items.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold">
        <ScanFace className="h-5 w-5 text-teal-600" /> Davomat: hali kelmaganlar
        <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-extrabold text-white">{items.length}</span>
      </h2>
      <Card className="divide-y divide-slate-100 p-0">
        {items.map((m) => {
          const label = MISSING_LABEL[m.stage === 'asked' ? 'asked' : (m.reason ?? 'no_answer')]
          return (
            <div key={m.teacherId} className="flex flex-wrap items-center gap-4 px-6 py-4">
              <Avatar name={m.fullName} />
              <div className="min-w-48 flex-1">
                <div className="font-extrabold">{m.fullName}</div>
                <div className="text-xs font-semibold text-slate-500">
                  Birinchi darsi: {m.firstLesson.para}-para, {m.firstLesson.startTime} · {m.firstLesson.className} · {m.firstLesson.subject}
                </div>
              </div>
              <Badge tone={label.tone} dot>{label.text}</Badge>
              <Button
                size="sm"
                variant="primary"
                icon={UserX}
                loading={open.isPending && open.variables === m.teacherId}
                disabled={open.isPending}
                onClick={() => open.mutate(m.teacherId)}
              >
                O'rinbosar qidirish
              </Button>
            </div>
          )
        })}
      </Card>
      {open.isError && <div className="mt-2 text-sm font-semibold text-rose-600">{(open.error as Error).message}</div>}
      <p className="mt-2 text-xs font-semibold text-slate-400">
        Davomatda kirishi yo'q ustozlar. Kamera tanimay qolgan bo'lishi mumkin — kelmasligi aniq bo'lsa, o'rinbosar qidiring.
      </p>
    </section>
  )
}

/** Taklifni qabul qilgan nomzod + "Tasdiqlash" (direktor yoki rahbariyat; mas'ulning tasdig'i ham yetarli) */
function ApproveRow({ caseId, teacherId, name }: { caseId: string; teacherId: string; name: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const approve = useMutation({
    mutationFn: () => api.approveCandidate(caseId, teacherId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overview'] })
      toast(`${name} o'rinbosar etib tasdiqlandi`)
    },
    onError: () => qc.invalidateQueries({ queryKey: ['overview'] }),
  })
  return (
    <div>
      <div className="flex items-center gap-2">
        <Avatar name={name} size="sm" />
        <span className="font-bold">{name}</span>
        <Badge tone="blue">rozi</Badge>
        <Button size="sm" variant="success" icon={UserCheck} loading={approve.isPending} onClick={() => approve.mutate()}>
          Tasdiqlash
        </Button>
      </div>
      {approve.isError && <div className="mt-1 text-xs font-semibold text-rose-600">{(approve.error as Error).message}</div>}
    </div>
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

  const { org } = useAdminOrg()
  const stats = useQuery({
    queryKey: ['dashboard-stats', date, branchId, org],
    queryFn: () => api.getDashboardStats(date, branchId || undefined, org === 'all' ? undefined : org),
    refetchInterval: 60_000,
  })
  const upcoming = stats.data?.upcoming.filter((u) => inOrg(u.branchId)) ?? []
  // Kelmaganlar filiallar bo'yicha (filtrsiz ro'yxatdan)
  const byBranch = Object.entries(
    (overview.data?.absences ?? [])
      .filter((a) => inOrg(a.teacher.branchId))
      .reduce<Record<string, number>>((m, a) => ({ ...m, [a.teacher.branchId]: (m[a.teacher.branchId] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <AdminHeader
        title={date === todayISO() ? 'Bugungi holat' : 'Kun holati'}
        subtitle={formatDate(date)}
        actions={
          <>
            <DateNav value={date} onChange={setDate} />
            {branches.length > 1 && (
              <BranchSelect value={branchId} onChange={setBranchId} branches={branches} allLabel="Barcha filiallar" className="min-w-60" />
            )}
          </>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kelmaganlar" value={loading ? '–' : absences.length} footer={loading ? undefined : `${allCases.length} ta darsga o'rinbosar kerak`} icon={UserX} gradient="from-brand to-brand-strong" bar="bg-brand" />
        <StatCard label="Topildi" value={loading ? '–' : count('found')} total={allCases.length} icon={CheckCircle2} gradient="from-emerald-400 to-teal-500" bar="bg-emerald-500" />
        <StatCard label="Kutilmoqda" value={loading ? '–' : count('pending')} total={allCases.length} icon={Hourglass} gradient="from-amber-400 to-orange-500" bar="bg-amber-500" />
        <StatCard label="Topilmadi" value={loading ? '–' : count('not_found')} total={allCases.length} icon={SearchX} gradient="from-rose-500 to-pink-600" bar="bg-rose-500" />
      </div>

      {/* 7 kunlik trend + yaqin kunlardagi arizalar */}
      <div className="mb-8 grid gap-5 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-extrabold">Oxirgi 7 kun</h2>
            <span className="text-xs font-semibold text-slate-400">o'rinbosar kerak bo'lgan darslar · ustunni bosing — o'sha kunga o'tadi</span>
          </div>
          {stats.data ? <WeekChart days={stats.data.week} selected={date} onSelect={setDate} /> : <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />}
        </Card>
        <Card className="flex flex-col p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold">
            <CalendarClock className="h-5 w-5 text-brand" /> Yaqin kunlarda
          </h2>
          {!stats.data ? (
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ) : upcoming.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
              <CalendarCheck2 className="mb-2 h-8 w-8 text-emerald-500" />
              <div className="text-sm font-extrabold">Kelgusi 7 kunga ariza yo'q</div>
              <div className="text-xs font-semibold text-slate-400">Yangi ariza tushsa, shu yerda ko'rinadi</div>
            </div>
          ) : (
            <div className="-mx-2 max-h-72 space-y-1 overflow-y-auto">
              {upcoming.map((u) => {
                const total = u.found + u.pending + u.notFound
                return (
                  <button
                    key={u.absenceId}
                    onClick={() => setDate(u.date)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-brand/8 py-1.5 text-brand-strong">
                      <span className="text-[10px] font-bold uppercase">{WEEKDAYS_SHORT[weekdayOf(u.date) - 1]}</span>
                      <span className="text-lg leading-none font-extrabold">{fromISO(u.date).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold">{u.teacherName}</div>
                      <div className="truncate text-xs font-semibold text-slate-400">{branchName(u.branchId)} · {total} ta dars</div>
                    </div>
                    {u.notFound > 0 ? (
                      <Badge tone="red" dot>{u.notFound} topilmadi</Badge>
                    ) : u.pending > 0 ? (
                      <Badge tone="amber" dot>{u.pending} kutilmoqda</Badge>
                    ) : (
                      <Badge tone="green" dot>Hal bo'ldi</Badge>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {date === todayISO() && <AttendanceMissingSection date={date} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">{date === todayISO() ? 'Bugun kelmaydiganlar' : `${formatDate(date)} — kelmaydiganlar`}</h2>
        {/* Filiallar kesimi: bosilsa — shu filial bo'yicha filtr */}
        {byBranch.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {byBranch.map(([id, n]) => (
              <button
                key={id}
                onClick={() => setBranchId(branchId === id ? '' : id)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition',
                  branchId === id ? 'bg-brand text-white ring-brand' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand/50',
                )}
              >
                {branchName(id)} · {n}
              </button>
            ))}
          </div>
        )}
      </div>
      {overview.isPending ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : absences.length === 0 ? (
        <Card className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/25">
            <PartyPopper className="h-6 w-6" />
          </div>
          <div>
            <div className="font-extrabold">Bu kuni kelmaydigan xodim yo'q</div>
            <div className="text-sm font-medium text-slate-500">Hamma mashg'ulot va darslar o'z vaqtida o'tadi.</div>
          </div>
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
                    {a.cases.some((c) => c.lateNotice) && <Badge tone="amber" dot>Kech xabar berildi</Badge>}
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
                        <td className="px-4 py-3.5">
                          <div className="font-bold">{c.lesson.className}</div>
                          <div className="text-xs font-semibold text-slate-400">{c.lesson.subject}</div>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-500">{c.lesson.room}</td>
                        <td className="px-4 py-3.5">
                          {c.chosenTeacher ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={c.chosenTeacher.fullName} size="sm" />
                              <div>
                                <div className="font-bold">{c.chosenTeacher.fullName}</div>
                                {c.chosenBy && <div className="text-xs font-semibold text-slate-400">Tasdiqladi — {c.chosenBy}</div>}
                              </div>
                            </div>
                          ) : c.status === 'pending' && c.candidates.length > 0 ? (
                            <div className="space-y-1.5">
                              {c.candidates.map((cand) => (
                                <ApproveRow key={cand.teacherId} caseId={c.id} teacherId={cand.teacherId} name={cand.fullName} />
                              ))}
                            </div>
                          ) : c.status === 'pending' ? (
                            <span className="font-semibold text-slate-400">Ustozlar javobi kutilmoqda</span>
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
