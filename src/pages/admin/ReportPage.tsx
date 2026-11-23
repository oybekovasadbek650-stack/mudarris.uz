// Oylik hisobot: o'rinbosar tizimi (arizalar, o'rinbosar darslar, haq) + davomat (kelgan kunlar, kechikish, ish vaqti).
// "Sababsiz kelmagan" — davomatda kirish yo'q va "Kela olmayman" arizasi ham yo'q kunlar.
import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Clock3, Download, Repeat2, ScanFace, TrendingUp, UserX, Wallet } from 'lucide-react'
import { api } from '../../api'
import { formatDate, formatMoney, formatMonth, todayISO } from '../../lib/date'
import type { MonthlyReportRow } from '../../types'
import { Alert, Avatar, Button, Card, EmptyState, ErrorState, IconTile, LoadingState, cx } from '../../components/ui'
import { AdminHeader } from './AdminLayout'
import { MonthNav } from '../../components/Pickers'
import { useAdminOrg, useOrgBranches } from '../../lib/adminOrg'
import { WeekChart } from '../../components/WeekChart'

const hours = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h} soat${m ? ` ${m} daq` : ''}` : `${m} daq`
}

function downloadCsv(month: string, rows: MonthlyReportRow[], withDavomat: boolean) {
  const header = ['Ism-familiya', 'Ariza bilan kelmagan (kun)', "O'rinbosar darslar", "Haq (so'm)"]
  if (withDavomat) {
    header.push('Davomat: ish kunlari', 'Davomat: kelgan kunlar', 'Kechikkan kunlar', 'Kechikish (daqiqa)', 'Ishlagan (soat)', 'Sababsiz kelmagan (kun)', 'Sababsiz kelmagan sanalar')
  }
  const lines = rows.map((r) => {
    const base: (string | number)[] = [r.fullName, r.absentDays, r.substitutedLessons, r.payment]
    if (withDavomat) {
      const d = r.davomat
      base.push(
        d ? d.workingDays : "bog'lanmagan",
        d ? d.presentDays : '',
        d ? d.lateDays : '',
        d ? d.lateMinutes : '',
        d ? (d.workedMinutes / 60).toFixed(1) : '',
        d ? d.unexplainedAbsentDates.length : '',
        d ? d.unexplainedAbsentDates.join(', ') : '',
      )
    }
    return base
  })
  const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }) // BOM — Excel o'zbek harflarini to'g'ri ochishi uchun
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `hisobot-${month}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function StatCard({ icon, gradient, value, label }: { icon: typeof UserX; gradient: string; value: string | number; label: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <IconTile icon={icon} gradient={gradient} />
      <div>
        <div className="text-3xl font-extrabold">{value}</div>
        <div className="text-sm font-bold text-slate-500">{label}</div>
      </div>
    </Card>
  )
}

export default function ReportPage() {
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [open, setOpen] = useState<string | null>(null)
  const report = useQuery({ queryKey: ['report', month], queryFn: () => api.getMonthlyReport(month) })

  const { inOrg } = useOrgBranches()
  const dv = report.data?.davomat
  const withDavomat = Boolean(dv?.ok && report.data?.rows.some((r) => r.davomat))
  const rows = (report.data?.rows ?? [])
    .filter((r) => !r.branchId || inOrg(r.branchId))
    .sort(
      (a, b) =>
        (b.davomat?.unexplainedAbsentDates.length ?? 0) - (a.davomat?.unexplainedAbsentDates.length ?? 0) ||
        b.substitutedLessons - a.substitutedLessons ||
        b.absentDays - a.absentDays,
    )
  const total = rows.reduce(
    (s, r) => ({
      absent: s.absent + r.absentDays,
      subs: s.subs + r.substitutedLessons,
      pay: s.pay + r.payment,
      unexplained: s.unexplained + (r.davomat?.unexplainedAbsentDates.length ?? 0),
      lateDays: s.lateDays + (r.davomat?.lateDays ?? 0),
      lateMin: s.lateMin + (r.davomat?.lateMinutes ?? 0),
    }),
    { absent: 0, subs: 0, pay: 0, unexplained: 0, lateDays: 0, lateMin: 0 },
  )
  const maxSubs = Math.max(1, ...rows.map((r) => r.substitutedLessons))
  const notLinked = rows.filter((r) => !r.davomat).length

  // Oy bo'yicha kunlik grafik: oyning hamma kunlari
  const { org } = useAdminOrg()
  const [yy, mm] = month.split('-').map(Number)
  const daysInMonth = new Date(yy, mm, 0).getDate()
  const monthStats = useQuery({
    queryKey: ['dashboard-stats', 'month', month, org],
    queryFn: () => api.getDashboardStats(`${month}-${String(daysInMonth).padStart(2, '0')}`, undefined, org === 'all' ? undefined : org, daysInMonth),
  })

  return (
    <div>
      <AdminHeader
        title="Oylik hisobot"
        subtitle={`${formatMonth(month)}${withDavomat ? ' · davomat bilan' : ''}`}
        actions={
          <>
            <MonthNav value={month} onChange={setMonth} />
            <Button variant="white" icon={Download} disabled={!rows.length} onClick={() => downloadCsv(month, rows, withDavomat)}>
              Excel (CSV)
            </Button>
          </>
        }
      />

      {dv?.enabled && !dv.ok && (
        <div className="mb-5">
          <Alert tone="amber">Davomat ma'lumoti olinmadi: {dv.error}. Hisobot faqat o'rinbosar tizimi ma'lumoti bilan ko'rsatilmoqda.</Alert>
        </div>
      )}

      <div className={cx('mb-6 grid gap-4', withDavomat ? 'md:grid-cols-2 xl:grid-cols-5' : 'md:grid-cols-3')}>
        <StatCard icon={UserX} gradient="from-brand to-brand-strong" value={total.absent} label="ariza bilan kelmagan kun" />
        {withDavomat && <StatCard icon={AlertTriangle} gradient="from-rose-500 to-pink-600" value={total.unexplained} label="sababsiz kelmagan kun" />}
        {withDavomat && <StatCard icon={Clock3} gradient="from-amber-400 to-orange-500" value={total.lateDays} label={`kechikish · ${hours(total.lateMin)}`} />}
        <StatCard icon={Repeat2} gradient="from-violet-500 to-fuchsia-500" value={total.subs} label="o'rinbosar darslar" />
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-500/25">
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/15" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-extrabold">{formatMoney(total.pay)}</div>
              <div className="text-sm font-bold text-white/80">jami to'lov</div>
            </div>
          </div>
        </div>
      </div>

      <Card className="mb-6 p-6">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold">{formatMonth(month)}: kunlar bo'yicha</h2>
          <span className="text-xs font-semibold text-slate-400">o'rinbosar kerak bo'lgan darslar · ustun ustiga keling</span>
        </div>
        {monthStats.data ? (
          <WeekChart days={monthStats.data.week} label={formatMonth(month)} />
        ) : (
          <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
        )}
      </Card>

      {report.isPending ? (
        <LoadingState />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={TrendingUp} title="Bu oy uchun ma'lumot yo'q" />
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className={cx('w-full text-sm', withDavomat ? 'min-w-[940px]' : 'min-w-[720px]')}>
              <thead className="bg-slate-50 text-left text-xs font-bold text-slate-400 uppercase">
                <tr>
                  <th className="px-6 py-3.5 align-bottom">O'qituvchi</th>
                  <th className="px-3 py-3.5 text-center" title="«Kela olmayman» arizasi bilan">Ariza bilan<br />kelmagan</th>
                  {withDavomat && (
                    <>
                      <th className="px-3 py-3.5 text-center" title="Davomatda kirish yo'q va ariza ham yo'q">Sababsiz<br />kelmagan</th>
                      <th className="px-3 py-3.5 text-center">Davomat<br />kelgan / ish kuni</th>
                      <th className="px-3 py-3.5 text-center">Kechikish</th>
                      <th className="px-3 py-3.5 text-center">Ishlagan</th>
                    </>
                  )}
                  <th className={cx('px-4 py-3.5', withDavomat && 'w-40')}>O'rinbosar<br />darslar</th>
                  <th className="px-6 py-3.5 text-right">Haqi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = r.davomat
                  const unexplained = d?.unexplainedAbsentDates.length ?? 0
                  const expanded = open === r.teacherId
                  return (
                    <Fragment key={r.teacherId}>
                      <tr className={cx('border-t border-slate-100 hover:bg-brand/5', unexplained > 0 && 'bg-rose-50/50')}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.fullName} size="sm" />
                            <span className="font-extrabold">{r.fullName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r.absentDays ? (
                            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-rose-50 px-2 font-extrabold text-rose-600">{r.absentDays}</span>
                          ) : (
                            <span className="font-bold text-slate-300">0</span>
                          )}
                        </td>
                        {withDavomat && (
                          <>
                            <td className="px-3 py-3 text-center">
                              {!d ? (
                                <span className="text-xs font-semibold text-slate-400" title="Ustoz davomat tizimiga bog'lanmagan">bog'lanmagan</span>
                              ) : unexplained ? (
                                <button
                                  onClick={() => setOpen(expanded ? null : r.teacherId)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-2.5 py-1 font-extrabold text-white shadow-sm hover:bg-red-700"
                                  title="Sanalarni ko'rish"
                                >
                                  {unexplained} <ChevronDown className={cx('h-3.5 w-3.5 transition', expanded && 'rotate-180')} />
                                </button>
                              ) : (
                                <span className="font-bold text-slate-300">0</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center font-semibold text-slate-600">{d ? `${d.presentDays} / ${d.workingDays}` : '—'}</td>
                            <td className="px-3 py-3 text-center">
                              {d?.lateDays ? (
                                <span className="font-bold text-amber-700">
                                  {d.lateDays} kun <span className="text-xs font-semibold text-slate-400">· {hours(d.lateMinutes)}</span>
                                </span>
                              ) : (
                                <span className="font-bold text-slate-300">{d ? '0' : '—'}</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center font-semibold whitespace-nowrap text-slate-600">{d ? hours(d.workedMinutes) : '—'}</td>
                          </>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 min-w-12 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-linear-to-r from-brand to-brand-strong" style={{ width: `${(r.substitutedLessons / maxSubs) * 100}%` }} />
                            </div>
                            <span className="w-6 text-right font-extrabold">{r.substitutedLessons}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right font-extrabold whitespace-nowrap text-emerald-700">{r.payment ? formatMoney(r.payment) : <span className="text-slate-300">—</span>}</td>
                      </tr>
                      {expanded && d && (
                        <tr className="bg-rose-50/60">
                          <td colSpan={withDavomat ? 8 : 4} className="px-6 py-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-rose-800">
                              <span className="font-extrabold">Sababsiz kelmagan kunlar:</span>
                              {d.unexplainedAbsentDates.map((date) => (
                                <span key={date} className="rounded-lg bg-white px-2 py-1 ring-1 ring-rose-200">{formatDate(date)}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-extrabold">
                  <td className="px-6 py-4">Jami</td>
                  <td className="px-3 py-4 text-center">{total.absent}</td>
                  {withDavomat && (
                    <>
                      <td className="px-3 py-4 text-center text-red-700">{total.unexplained}</td>
                      <td className="px-3 py-4" />
                      <td className="px-3 py-4 text-center text-amber-700">{total.lateDays} kun</td>
                      <td className="px-3 py-4" />
                    </>
                  )}
                  <td className="px-4 py-4">{total.subs} ta dars</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap text-emerald-700">{formatMoney(total.pay)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
          {withDavomat && (
            <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-slate-400">
              <ScanFace className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Davomat ustunlari — kamera ma'lumoti (oy boshidan kechagacha). «Sababsiz kelmagan» — davomatda kirish yo'q va «Kela olmayman» arizasi ham
              berilmagan ish kunlari; kamera tanimay qolgan bo'lishi mumkin, maoshdan ushlashdan oldin tekshiring.
              {notLinked > 0 && ` ${notLinked} ta ustoz davomatga bog'lanmagan («Davomatdan olish» sahifasi).`}
            </p>
          )}
        </>
      )}
    </div>
  )
}
