// Dars jadvali: hafta ko'rinishi (kunlar x paralar), sinf bo'yicha filtr, Excel'dan yuklash
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarRange, FileSpreadsheet } from 'lucide-react'
import { ORGS } from '../../lib/org'
import type { Org } from '../../types'
import { api } from '../../api'
import { WEEKDAYS, todayISO, weekdayOf } from '../../lib/date'
import { tintOf } from '../../lib/colors'
import { Alert, Button, Card, EmptyState, ErrorState, LoadingState, cx } from '../../components/ui'
import { AdminHeader } from './AdminLayout'
import { useOrgBranches } from '../../lib/adminOrg'
import { BranchSelect } from '../../components/BranchSelect'

const WEEK = [1, 2, 3, 4, 5, 6]
const PARAS = [1, 2, 3, 4, 5, 6]

export default function SchedulePage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { org, loaded, branches } = useOrgBranches()
  const noBranches = loaded && branches.length === 0
  const [pickedBranch, setBranchId] = useState('')
  const branchId = branches.some((b) => b.id === pickedBranch) ? pickedBranch : (branches[0]?.id ?? '')
  const [className, setClassName] = useState('')
  const today = weekdayOf(todayISO())

  const schedule = useQuery({
    queryKey: ['schedule', branchId],
    queryFn: () => api.getSchedule(branchId),
    enabled: Boolean(branchId),
  })

  const upload = useMutation({
    mutationFn: (file: File) => api.importSchedule(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })

  const classes = useMemo(
    () => [...new Set(schedule.data?.map((l) => l.className))].sort((a, b) => a.localeCompare(b, 'uz', { numeric: true })),
    [schedule.data],
  )
  const visible = schedule.data?.filter((l) => !className || l.className === className) ?? []
  // Yakshanba ustuni faqat shu kuni darslar bo'lsa (masalan akademiyada)
  const DAYS = schedule.data?.some((l) => l.weekday === 7) ? [...WEEK, 7] : WEEK
  const timeOf = (p: number) => schedule.data?.find((l) => l.para === p)

  return (
    <div>
      <AdminHeader
        title="Dars jadvali"
        subtitle={schedule.data ? `Haftalik ko'rinish · ${visible.length} ta dars` : "Haftalik ko'rinish"}
        actions={
          <>
            {branches.length > 1 && (
              <BranchSelect
                value={branchId}
                onChange={(id) => {
                  setBranchId(id)
                  setClassName('')
                }}
                branches={branches}
                className="min-w-60"
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload.mutate(f)
                e.target.value = ''
              }}
            />
            <Button variant="success" icon={FileSpreadsheet} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              Excel fayldan yuklash
            </Button>
          </>
        }
      />

      {/* Sinf filtri — chip ko'rinishida */}
      {classes.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {['', ...classes].map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setClassName(c)}
              className={cx(
                'rounded-full px-4 py-2 text-sm font-bold transition',
                className === c ? 'bg-linear-to-r from-brand to-brand-strong text-white shadow-lg shadow-brand/25' : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:ring-brand/50',
              )}
            >
              {c || 'Barcha sinflar'}
            </button>
          ))}
        </div>
      )}

      {upload.isError && <div className="mb-4"><Alert>{(upload.error as Error).message}</Alert></div>}
      {upload.isSuccess && (
        <div className="mb-4">
          <Alert tone={upload.data.errors.length ? 'amber' : 'green'}>
            {upload.data.imported > 0 && <div>{upload.data.imported} ta dars yuklandi.</div>}
            {upload.data.errors.map((e) => <div key={e}>{e}</div>)}
          </Alert>
        </div>
      )}

      {noBranches ? (
        <Card>
          <EmptyState
            icon={Building2}
            title={`${ORGS[org as Org]?.name ?? 'Bu tashkilot'}da hali filial yo'q`}
            text="Yuqoridagi tanlovdan boshqa tashkilotni tanlang yoki «Hammasi»ni bosing."
          />
        </Card>
      ) : schedule.isPending ? (
        <LoadingState />
      ) : schedule.isError ? (
        <ErrorState error={schedule.error} onRetry={() => schedule.refetch()} />
      ) : schedule.data.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarRange} title="Jadval hali yuklanmagan" text="Excel faylni yuklang: ustunlar — kun, para, sinf, fan, o'qituvchi, xona." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-28 px-4 py-4 text-left text-xs font-bold text-slate-400 uppercase">Para</th>
                {DAYS.map((d) => (
                  <th key={d} className="px-2 py-4 text-left">
                    <span
                      className={cx(
                        'inline-flex rounded-xl px-3 py-1.5 text-sm font-extrabold',
                        d === today ? 'bg-linear-to-r from-brand to-brand-strong text-white shadow-md shadow-brand/25' : 'text-slate-700',
                      )}
                    >
                      {WEEKDAYS[d - 1]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PARAS.map((p) => (
                <tr key={p} className="border-t border-slate-100">
                  <td className="px-4 py-3 align-top">
                    <div className="text-base font-extrabold">{p}-para</div>
                    <div className="font-semibold text-slate-400">{timeOf(p)?.startTime}–{timeOf(p)?.endTime}</div>
                  </td>
                  {DAYS.map((d) => {
                    const cell = visible.filter((l) => l.weekday === d && l.para === p)
                    return (
                      <td key={d} className={cx('p-1.5 align-top', d === today && 'bg-brand/6')}>
                        <div className="space-y-1.5">
                          {cell.map((l) => {
                            const tint = tintOf(l.subject)
                            return (
                              <div key={l.id} className={cx('relative overflow-hidden rounded-xl py-2 pr-2 pl-3', tint.soft)}>
                                <span className={cx('absolute inset-y-0 left-0 w-1', tint.bar)} />
                                <div className="flex items-center justify-between gap-1 font-extrabold">
                                  <span className="truncate">{l.subject}</span>
                                  <span className="shrink-0 rounded-md bg-white/70 px-1.5 text-[10px]">{l.className}</span>
                                </div>
                                <div className="truncate font-semibold text-slate-600">{l.teacherName}</div>
                                <div className="font-semibold text-slate-400">{l.room}-xona</div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
