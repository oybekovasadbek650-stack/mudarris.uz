// 7 kunlik trend: har kun — o'rinbosar kerak bo'lgan darslar, holat bo'yicha ustma-ust ustunlar.
// Holat ranglari (topildi/kutilmoqda/topilmadi) legenda va izoh bilan — rang yolg'iz ma'no tashimaydi.
import { useState } from 'react'
import type { DayStat } from '../types'
import { WEEKDAYS_SHORT, formatDate, fromISO, weekdayOf } from '../lib/date'
import { cx } from './ui'

const SERIES = [
  { key: 'found', label: 'Topildi', color: '#10b981' }, // emerald-500
  { key: 'pending', label: 'Kutilmoqda', color: '#f59e0b' }, // amber-500
  { key: 'notFound', label: 'Topilmadi', color: '#f43f5e' }, // rose-500
] as const

const W = 640
const H = 200
const PAD = { top: 12, right: 8, bottom: 36, left: 28 }

// Ko'p kun (oy) bo'lsa — ixcham: hafta kuni yozilmaydi, ustun ustidagi son faqat izohda
export function WeekChart({ days, selected, onSelect, label = 'Oxirgi 7 kun' }: { days: DayStat[]; selected?: string; onSelect?: (date: string) => void; label?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const totals = days.map((d) => d.found + d.pending + d.notFound)
  const max = Math.max(4, ...totals)
  const step = max <= 6 ? 1 : max <= 12 ? 2 : Math.ceil(max / 5)
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / days.length
  const barW = Math.min(36, slot * 0.5)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const empty = totals.every((t) => t === 0)
  const h = hover !== null ? days[hover] : null
  const dense = days.length > 10

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500" aria-hidden="true">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label}: o'rinbosar kerak bo'lgan darslar holati`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8" fontWeight="600">{t}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx0 = PAD.left + slot * i + slot / 2
          let acc = 0
          const isSel = d.date === selected
          return (
            <g key={d.date}>
              {/* Kengroq bosiladigan maydon */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={innerH + 30}
                fill={hover === i ? 'rgba(59,130,246,0.06)' : 'transparent'}
                rx={10}
                onMouseEnter={() => setHover(i)}
                onClick={() => onSelect?.(d.date)}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
              />
              {SERIES.map((s, si) => {
                const v = d[s.key]
                if (!v) return null
                const top = y(acc + v)
                const bottom = y(acc)
                acc += v
                const isTop = SERIES.slice(si + 1).every((n) => !d[n.key])
                const hgt = Math.max(0, bottom - top - 2) // 2px oraliq segmentlar orasida
                return (
                  <path
                    key={s.key}
                    pointerEvents="none"
                    fill={s.color}
                    d={
                      isTop && hgt >= 6
                        ? `M${cx0 - barW / 2},${bottom - 2} v${-(hgt - 4)} q0,-4 4,-4 h${barW - 8} q4,0 4,4 v${hgt - 4} z`
                        : `M${cx0 - barW / 2},${bottom - 2} v${-hgt} h${barW} v${hgt} z`
                    }
                  />
                )
              })}
              {totals[i] > 0 && !dense && (
                <text x={cx0} y={y(totals[i]) - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#334155" pointerEvents="none">
                  {totals[i]}
                </text>
              )}
              {!dense && <text x={cx0} y={H - 18} textAnchor="middle" fontSize="11" fontWeight={isSel ? 800 : 600} fill={isSel ? '#1d4ed8' : '#64748b'} pointerEvents="none">
                {WEEKDAYS_SHORT[weekdayOf(d.date) - 1]}
              </text>}
              <text x={cx0} y={H - 4} textAnchor="middle" fontSize="10" fill={isSel ? '#1d4ed8' : '#94a3b8'} fontWeight={isSel ? 800 : 500} pointerEvents="none">
                {fromISO(d.date).getDate()}
              </text>
            </g>
          )
        })}
        {empty && (
          <text x={W / 2} y={PAD.top + innerH / 2} textAnchor="middle" fontSize="13" fill="#94a3b8" fontWeight="700">
            Bu kunlarda arizalar bo'lmagan
          </text>
        )}
      </svg>

      {h && (
        <div
          className={cx('pointer-events-none absolute top-8 z-10 w-48 rounded-2xl bg-slate-900 p-3 text-xs text-white shadow-xl')}
          style={{ left: `clamp(0px, calc(${((hover! + 0.5) / days.length) * 100}% - 96px), calc(100% - 192px))` }}
        >
          <div className="mb-1.5 font-extrabold">{formatDate(h.date)}</div>
          <div className="mb-1 text-white/70">{h.absences} ta ustoz kelmagan</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-white/80">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}
              </span>
              <b>{h[s.key]}</b>
            </div>
          ))}
        </div>
      )}

      {/* Ekran o'quvchilar uchun jadval ko'rinishi */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Sana</th>
            <th>Kelmagan</th>
            {SERIES.map((s) => <th key={s.key}>{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{formatDate(d.date)}</td>
              <td>{d.absences}</td>
              {SERIES.map((s) => <td key={s.key}>{d[s.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
