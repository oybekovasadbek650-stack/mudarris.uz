// O'zbekcha sana/oy/vaqt tanlagichlari — brauzerning inglizcha "11/22/2026", "November 2026", "07:00 AM" o'rniga.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS, WEEKDAYS_SHORT, addDays, formatDate, formatMonth, fromISO, toISO, todayISO, weekdayOf } from '../lib/date'
import { cx } from './ui'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Tashqariga bosilganda yopiladigan ochiluvchi oyna */
function Popover({ open, onClose, children, align = 'right' }: { open: boolean; onClose: () => void; children: ReactNode; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      ref={ref}
      className={cx(
        'absolute top-full z-40 mt-2 w-72 animate-fade-up rounded-3xl bg-white p-4 text-slate-900 shadow-2xl ring-1 ring-black/5',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      {children}
    </div>
  )
}

/** Oy kalendari: dushanbadan boshlanadi, bugun belgilangan */
export function Calendar({ value, onChange, isAllowed }: { value: string; onChange: (d: string) => void; isAllowed?: (d: string) => boolean }) {
  const [view, setView] = useState(() => value.slice(0, 7))
  const [y, m] = view.split('-').map(Number)
  const first = `${view}-01`
  const offset = weekdayOf(first) - 1
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(y, m - 1, i + 1)))]
  const shift = (n: number) => setView(toISO(new Date(y, m - 1 + n, 1)).slice(0, 7))
  const today = todayISO()
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="rounded-xl p-1.5 hover:bg-slate-100" aria-label="Oldingi oy">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-extrabold">{formatMonth(view)}</div>
        <button type="button" onClick={() => shift(1)} className="rounded-xl p-1.5 hover:bg-slate-100" aria-label="Keyingi oy">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={w} className={cx('pb-1 text-[11px] font-bold', i === 6 ? 'text-rose-400' : 'text-slate-400')}>{w}</div>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              disabled={isAllowed ? !isAllowed(d) : false}
              onClick={() => onChange(d)}
              className={cx(
                'h-9 rounded-xl text-sm font-bold transition disabled:cursor-not-allowed disabled:text-slate-300',
                d === value
                  ? 'bg-linear-to-br from-brand to-brand-strong text-white shadow-md shadow-brand/25'
                  : d === today
                    ? 'text-brand-strong ring-2 ring-brand/40 hover:bg-brand/10'
                    : 'hover:bg-slate-100',
              )}
            >
              {fromISO(d).getDate()}
            </button>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  )
}

const navBtn = 'flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100 disabled:opacity-30'

/** Panel uchun: ‹ 22-noyabr, Yakshanba › + kalendar */
export function DateNav({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false)
  const today = todayISO()
  return (
    <div className="relative flex items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button type="button" className={navBtn} onClick={() => onChange(addDays(value, -1))} aria-label="Oldingi kun">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 px-2 text-sm font-extrabold whitespace-nowrap" aria-haspopup="dialog">
        <CalendarDays className="h-4 w-4 text-brand" />
        {value === today ? 'Bugun · ' : ''}
        {formatDate(value)}
      </button>
      <button type="button" className={navBtn} onClick={() => onChange(addDays(value, 1))} aria-label="Keyingi kun">
        <ChevronRight className="h-4 w-4" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <Calendar
          value={value}
          onChange={(d) => {
            onChange(d)
            setOpen(false)
          }}
        />
        {value !== today && (
          <button
            type="button"
            onClick={() => {
              onChange(today)
              setOpen(false)
            }}
            className="mt-3 w-full rounded-xl bg-brand/8 py-2 text-sm font-extrabold text-brand-strong hover:bg-brand/15"
          >
            Bugunga qaytish
          </button>
        )}
      </Popover>
    </div>
  )
}

/** Mini App uchun: "Boshqa sana" tugmasi + kalendar (faqat ruxsat etilgan kunlar) */
export function DatePickButton({ value, onChange, isAllowed, label }: { value: string; onChange: (d: string) => void; isAllowed?: (d: string) => boolean; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl bg-slate-500/8 px-4 py-3 text-sm font-bold transition hover:bg-slate-500/12"
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" /> {label}
        </span>
        <span className="text-tg-hint">{formatDate(value)}</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="left">
        <Calendar
          value={value}
          isAllowed={isAllowed}
          onChange={(d) => {
            onChange(d)
            setOpen(false)
          }}
        />
      </Popover>
    </div>
  )
}

/** ‹ Noyabr 2026 › + oylar to'ri */
export function MonthNav({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [y, m] = value.split('-').map(Number)
  const [year, setYear] = useState(y)
  const shift = (n: number) => onChange(toISO(new Date(y, m - 1 + n, 1)).slice(0, 7))
  return (
    <div className="relative flex items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button type="button" className={navBtn} onClick={() => shift(-1)} aria-label="Oldingi oy">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          setYear(y)
          setOpen((o) => !o)
        }}
        className="flex items-center gap-2 px-2 text-sm font-extrabold whitespace-nowrap"
      >
        <CalendarDays className="h-4 w-4 text-brand" /> {formatMonth(value)}
      </button>
      <button type="button" className={navBtn} onClick={() => shift(1)} aria-label="Keyingi oy">
        <ChevronRight className="h-4 w-4" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setYear(year - 1)} className="rounded-xl p-1.5 hover:bg-slate-100" aria-label="Oldingi yil">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-extrabold">{year}</div>
          <button type="button" onClick={() => setYear(year + 1)} className="rounded-xl p-1.5 hover:bg-slate-100" aria-label="Keyingi yil">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((name, i) => {
            const v = `${year}-${String(i + 1).padStart(2, '0')}`
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  onChange(v)
                  setOpen(false)
                }}
                className={cx(
                  'rounded-xl py-2.5 text-sm font-bold transition',
                  v === value ? 'bg-linear-to-br from-brand to-brand-strong text-white shadow-md shadow-brand/25' : 'hover:bg-slate-100',
                )}
              >
                {cap(name)}
              </button>
            )
          })}
        </div>
      </Popover>
    </div>
  )
}

/** 24 soatlik vaqt: soat va daqiqa tanlovi (AM/PM yo'q) */
export function TimeField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [h, m] = value.split(':')
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
  if (!minutes.includes(m)) minutes.push(m)
  const sel =
    'appearance-none rounded-xl bg-transparent px-2 py-2 text-center text-base font-extrabold outline-none focus:bg-white focus:ring-2 focus:ring-brand disabled:cursor-not-allowed'
  return (
    <div className={cx('flex items-center justify-center gap-1 rounded-2xl bg-slate-50 px-2 py-1 ring-1 ring-slate-200 sm:w-44', disabled && 'text-slate-400')}>
      <select className={sel} value={h} disabled={disabled} onChange={(e) => onChange(`${e.target.value}:${m}`)} aria-label="Soat">
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
      <span className="font-extrabold">:</span>
      <select className={sel} value={m} disabled={disabled} onChange={(e) => onChange(`${h}:${e.target.value}`)} aria-label="Daqiqa">
        {minutes.sort().map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
      <span className="ml-1 text-xs font-bold text-slate-400">gacha</span>
    </div>
  )
}
