// "Kela olmayman": sana -> shu kungi darslar avtomatik -> sabab -> Yuborish
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, Send, Sun } from 'lucide-react'
import { api } from '../../api'
import { addDays, formatDate, fromISO, todayISO, WEEKDAYS_SHORT, weekdayOf } from '../../lib/date'
import { tintOf } from '../../lib/colors'
import { haptic } from '../../lib/telegram'
import type { Me } from '../../types'
import { DatePickButton } from '../../components/Pickers'
import { Alert, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Step, cx, inputClass } from '../../components/ui'

const QUICK_REASONS = ['Kasallik', 'Oilaviy sabab', 'Malaka oshirish', 'Xizmat safari']
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6]

export default function AbsencePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  // Filialning ish kunlari (masalan akademiyada yakshanba ham bo'lishi mumkin); me RequireAuth'da yuklangan
  const workDays = qc.getQueryData<Me>(['me'])?.workDays ?? DEFAULT_WORK_DAYS
  const isWorkDay = (d: string) => workDays.includes(weekdayOf(d))
  // Bugun dam olish kuni bo'lsa — standart sana keyingi ish kuni
  const [date, setDateRaw] = useState(() => {
    let d = todayISO()
    for (let i = 0; i < 7 && !isWorkDay(d); i++) d = addDays(d, 1)
    return d
  })
  const [reason, setReason] = useState('')
  // Standart holatda o'sha kungi hamma darslar belgilangan; foydalanuvchi olib tashlaganlarini saqlaymiz
  const [unchecked, setUnchecked] = useState<string[]>([])
  const setDate = (d: string) => {
    setDateRaw(d)
    setUnchecked([])
  }

  const lessons = useQuery({ queryKey: ['my-lessons', date], queryFn: () => api.getMyLessons(date) })
  const selected = (lessons.data ?? []).map((l) => l.id).filter((id) => !unchecked.includes(id))

  const submit = useMutation({
    mutationFn: () => api.createAbsence({ date, reason, lessonIds: selected }),
    onSuccess: () => {
      haptic('success')
      qc.invalidateQueries()
    },
    onError: () => haptic('error'),
  })

  if (submit.isSuccess) {
    return (
      <Card className="mt-8">
        <EmptyState
          icon={CheckCircle2}
          gradient="from-emerald-400 to-teal-500"
          title="Ariza yuborildi!"
          text={`${formatDate(date)} uchun ${submit.data.casesCount} ta dars bo'yicha o'rinbosar qidirilmoqda. Natija haqida bot orqali xabar olasiz.`}
          action={<Button onClick={() => navigate('/app')}>Bosh sahifaga</Button>}
        />
      </Card>
    )
  }

  const toggle = (id: string) => setUnchecked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const canSubmit = selected.length > 0 && reason.trim().length >= 3
  const quickDays = Array.from({ length: 7 }, (_, n) => addDays(todayISO(), n)).filter(isWorkDay)

  return (
    <div>
      <PageHeader title="Kela olmayman" subtitle="Uch qadamda ariza yuboring" back="/app" />

      <div className="space-y-4">
        <Card>
          <Step n={1} title="Qaysi kuni?" />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {quickDays.map((d) => {
              const active = d === date
              return (
                <button
                  key={d}
                  onClick={() => setDate(d)}
                  className={cx(
                    'flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5 transition',
                    active ? 'bg-linear-to-br from-brand to-brand-strong text-white shadow-lg shadow-brand/30' : 'bg-slate-500/8',
                  )}
                >
                  <span className={cx('text-[11px] font-bold', active ? 'text-white/80' : 'text-tg-hint')}>
                    {d === todayISO() ? 'Bugun' : d === addDays(todayISO(), 1) ? 'Ertaga' : WEEKDAYS_SHORT[weekdayOf(d) - 1]}
                  </span>
                  <span className="text-xl font-extrabold">{fromISO(d).getDate()}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-3">
            <DatePickButton
              label="Boshqa sana"
              value={date}
              onChange={setDate}
              isAllowed={(d) => d >= todayISO() && d <= addDays(todayISO(), 60) && isWorkDay(d)}
            />
          </div>
        </Card>

        <Card>
          <Step n={2} title="Qaysi darslar?" />
          <p className="-mt-1 mb-3 text-xs font-semibold text-tg-hint">{formatDate(date)}</p>
          {lessons.isPending ? (
            <LoadingState />
          ) : lessons.isError ? (
            <ErrorState error={lessons.error} onRetry={() => lessons.refetch()} />
          ) : lessons.data.length === 0 ? (
            <EmptyState icon={Sun} gradient="from-amber-400 to-orange-500" title="Bu kuni darsingiz yo'q" text="Ariza yuborish shart emas." />
          ) : (
            <div className="space-y-2">
              {lessons.data.map((l) => {
                const on = selected.includes(l.id)
                const tint = tintOf(l.subject)
                return (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-2 transition',
                      on ? 'bg-brand/8 ring-brand' : 'bg-slate-500/6 ring-transparent',
                    )}
                  >
                    <span className={cx('flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl', tint.soft)}>
                      <span className="text-base leading-none font-extrabold">{l.para}</span>
                      <span className="text-[9px] font-bold">para</span>
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-extrabold">{l.subject} · {l.className}</span>
                      <span className="block text-xs font-semibold text-tg-hint">{l.startTime}–{l.endTime} · {l.room}-xona</span>
                    </span>
                    <span
                      className={cx(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition',
                        on ? 'bg-brand text-white' : 'ring-2 ring-slate-400/40',
                      )}
                    >
                      {on && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <Step n={3} title="Sabab" />
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-xs font-bold transition',
                  reason === r ? 'bg-brand text-white shadow-md shadow-brand/30' : 'bg-brand/10 text-brand-strong',
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Yoki o'zingiz yozing..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Card>

        {submit.isError && <Alert>{(submit.error as Error).message}</Alert>}

        <Button
          size="lg"
          icon={Send}
          className="w-full"
          disabled={!canSubmit}
          loading={submit.isPending}
          onClick={() => submit.mutate()}
        >
          Yuborish · {selected.length} ta dars
        </Button>
      </div>
    </div>
  )
}
