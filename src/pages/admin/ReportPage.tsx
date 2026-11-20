// Oylik hisobot: har bir ustozning kelmagan kunlari, o'rinbosar bo'lgan darslari va haqi
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Repeat2, TrendingUp, UserX, Wallet } from 'lucide-react'
import { api } from '../../api'
import { formatMoney, formatMonth, todayISO } from '../../lib/date'
import type { MonthlyReportRow } from '../../types'
import { Avatar, Button, Card, EmptyState, ErrorState, IconTile, LoadingState } from '../../components/ui'
import { AdminHeader, selectClass } from './AdminLayout'
import { useOrgBranches } from '../../lib/adminOrg'

function downloadCsv(month: string, rows: MonthlyReportRow[]) {
  const header = ['Ism-familiya', 'Kelmagan kunlar', "O'rinbosar darslar", "Haq (so'm)"]
  const lines = rows.map((r) => [r.fullName, r.absentDays, r.substitutedLessons, r.payment])
  const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }) // BOM — Excel o'zbek harflarini to'g'ri ochishi uchun
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `hisobot-${month}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function ReportPage() {
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const report = useQuery({ queryKey: ['report', month], queryFn: () => api.getMonthlyReport(month) })

  const { inOrg } = useOrgBranches()
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: api.getTeachers })
  const branchOf = (id: string) => teachers.data?.find((t) => t.id === id)?.branchId ?? ''
  const rows = (report.data ?? []).filter((r) => inOrg(branchOf(r.teacherId))).sort((a, b) => b.substitutedLessons - a.substitutedLessons || b.absentDays - a.absentDays)
  const total = rows.reduce(
    (s, r) => ({ absent: s.absent + r.absentDays, subs: s.subs + r.substitutedLessons, pay: s.pay + r.payment }),
    { absent: 0, subs: 0, pay: 0 },
  )
  const maxSubs = Math.max(1, ...rows.map((r) => r.substitutedLessons))

  return (
    <div>
      <AdminHeader
        title="Oylik hisobot"
        subtitle={formatMonth(month)}
        actions={
          <>
            <input type="month" className={selectClass} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            <Button variant="white" icon={Download} disabled={!rows.length} onClick={() => downloadCsv(month, rows)}>
              Excel (CSV)
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <IconTile icon={UserX} gradient="from-rose-500 to-pink-600" />
          <div>
            <div className="text-3xl font-extrabold">{total.absent}</div>
            <div className="text-sm font-bold text-slate-500">kelmagan kunlar</div>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <IconTile icon={Repeat2} gradient="from-brand to-brand-strong" />
          <div>
            <div className="text-3xl font-extrabold">{total.subs}</div>
            <div className="text-sm font-bold text-slate-500">o'rinbosar darslar</div>
          </div>
        </Card>
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

      {report.isPending ? (
        <LoadingState />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={TrendingUp} title="Bu oy uchun ma'lumot yo'q" />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-3.5">O'qituvchi</th>
                <th className="px-4 py-3.5 text-center">Kelmagan kunlar</th>
                <th className="w-1/3 px-4 py-3.5">O'rinbosar darslar</th>
                <th className="px-6 py-3.5 text-right">Haqi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.teacherId} className="border-t border-slate-100 hover:bg-brand/5">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.fullName} size="sm" />
                      <span className="font-extrabold">{r.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.absentDays ? (
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-rose-50 px-2 font-extrabold text-rose-600">{r.absentDays}</span>
                    ) : (
                      <span className="font-bold text-slate-300">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-linear-to-r from-brand to-brand-strong" style={{ width: `${(r.substitutedLessons / maxSubs) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right font-extrabold">{r.substitutedLessons}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-extrabold whitespace-nowrap text-emerald-700">{r.payment ? formatMoney(r.payment) : <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-extrabold">
                <td className="px-6 py-4">Jami</td>
                <td className="px-4 py-4 text-center">{total.absent}</td>
                <td className="px-4 py-4">{total.subs} ta dars</td>
                <td className="px-6 py-4 text-right whitespace-nowrap text-emerald-700">{formatMoney(total.pay)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  )
}
