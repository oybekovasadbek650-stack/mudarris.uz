// Sozlamalar: xabar berish muddati, kunlik chegara, boshqa filialga o'tish, haq miqdori
import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, Building2, Gauge, Wallet, type LucideIcon } from 'lucide-react'
import { api } from '../../api'
import { formatMoney } from '../../lib/date'
import type { Settings } from '../../types'
import { Alert, Button, Card, ErrorState, IconTile, LoadingState, cx } from '../../components/ui'
import { AdminHeader } from './AdminLayout'

function SettingRow({ icon, gradient, title, hint, children }: { icon: LucideIcon; gradient: string; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-5 first:pt-0 last:pb-0">
      <IconTile icon={icon} gradient={gradient} />
      <div className="min-w-48 flex-1">
        <div className="font-extrabold">{title}</div>
        <div className="text-sm font-medium text-slate-500">{hint}</div>
      </div>
      <div className="w-full sm:w-auto">{children}</div>
    </div>
  )
}

const numInput =
  'w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-right text-base font-extrabold ring-1 ring-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-brand sm:w-44'

export default function SettingsPage() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['settings'], queryFn: api.getSettings })
  const [draft, setForm] = useState<Settings | null>(null)
  const form = draft ?? query.data ?? null // tahrirlanmagan bo'lsa — serverdagi qiymat

  const save = useMutation({
    mutationFn: (s: Settings) => api.saveSettings(s),
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data)
      setForm(null)
    },
  })

  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (!form) return <LoadingState />

  const update = (patch: Partial<Settings>) => {
    save.reset()
    setForm({ ...form, ...patch })
  }
  const dirty = JSON.stringify(form) !== JSON.stringify(query.data)

  return (
    <div className="max-w-3xl">
      <AdminHeader title="Sozlamalar" subtitle="O'rinbosar qidirish qoidalari" />
      <Card className="divide-y divide-slate-100 p-6">
        <SettingRow icon={AlarmClock} gradient="from-brand to-brand-strong" title="Xabar berish muddati" hint="Darsdan kamida necha soat oldin xabar berish kerak">
          <div className="relative">
            <input type="number" min={0} max={168} className={numInput} value={form.noticeHours} onChange={(e) => update({ noticeHours: Number(e.target.value) })} />
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-bold text-slate-400">soat</span>
          </div>
        </SettingRow>
        <SettingRow icon={Gauge} gradient="from-amber-400 to-orange-500" title="Kunlik chegara" hint="Bir ustoz bir kunda ko'pi bilan nechta o'rinbosar darsga kiradi">
          <div className="relative">
            <input type="number" min={1} max={10} className={numInput} value={form.dailyLimit} onChange={(e) => update({ dailyLimit: Number(e.target.value) })} />
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-bold text-slate-400">dars</span>
          </div>
        </SettingRow>
        <SettingRow icon={Wallet} gradient="from-emerald-400 to-teal-500" title="Haq miqdori" hint={`Bitta o'rinbosar dars uchun: ${formatMoney(form.paymentPerLesson || 0)}`}>
          <div className="relative">
            <input type="number" min={0} step={1000} className={numInput} value={form.paymentPerLesson} onChange={(e) => update({ paymentPerLesson: Number(e.target.value) })} />
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-bold text-slate-400">so'm</span>
          </div>
        </SettingRow>
        <SettingRow icon={Building2} gradient="from-violet-500 to-fuchsia-500" title="Boshqa filialga o'tish" hint="O'z filialida nomzod topilmasa, boshqa filial ustozlariga ham taklif yuboriladi">
          <button
            role="switch"
            aria-checked={form.allowCrossBranch}
            onClick={() => update({ allowCrossBranch: !form.allowCrossBranch })}
            className={cx(
              'relative h-8 w-14 rounded-full transition',
              form.allowCrossBranch ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/30' : 'bg-slate-200',
            )}
          >
            <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', form.allowCrossBranch ? 'left-7' : 'left-1')} />
          </button>
        </SettingRow>
      </Card>

      <div className="mt-5 space-y-4">
        {save.isError && <Alert>{(save.error as Error).message}</Alert>}
        {save.isSuccess && <Alert tone="green">Sozlamalar saqlandi</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="white" disabled={!dirty} onClick={() => setForm(null)}>Bekor qilish</Button>
          <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(form)}>Saqlash</Button>
        </div>
      </div>
    </div>
  )
}
