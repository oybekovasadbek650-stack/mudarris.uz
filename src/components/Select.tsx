// Brauzerning oddiy <select> o'rniga: chiroyli tugma, guruhlangan ro'yxat, qidiruv, belgi, klaviatura.
// Ro'yxat portal orqali body'ga chiziladi — modal/kartaning overflow-hidden'i uni kesmaydi.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cx } from './ui'

export interface SelectOption {
  value: string
  label: string
  group?: string // guruh sarlavhasi (masalan "Mudarris Xususiy Maktabi")
  icon?: ReactNode
  hint?: string // o'ng tomonda kichik matn (masalan "3 ustoz")
}

export interface SelectGroupMeta {
  [group: string]: { icon?: ReactNode }
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  groups?: SelectGroupMeta
  placeholder?: string
  /** filter — oq tugma (sahifa tepasidagi filtrlar); field — forma maydoni */
  variant?: 'filter' | 'field'
  ariaLabel?: string
  className?: string
  /** Qidiruv maydoni: standart — variantlar 7 tadan ko'p bo'lsa */
  searchable?: boolean
  disabled?: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/[ʻʼ'‘’`]/g, '')

export function Select({ value, onChange, options, groups, placeholder = 'Tanlang…', variant = 'filter', ariaLabel, className, searchable, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean; maxH: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)
  const withSearch = searchable ?? options.length > 7

  const filtered = useMemo(() => {
    const q = norm(query.trim())
    return q ? options.filter((o) => norm(o.label).includes(q) || norm(o.group ?? '').includes(q)) : options
  }, [options, query])

  // Ochilganda joylashuvni hisoblash: pastda joy yetmasa — tepaga ochiladi
  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    const up = below < 260 && above > below
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: Math.max(r.width, 260), up, maxH: Math.min(380, up ? above : below) })
  }
  useLayoutEffect(() => {
    if (open) place()
  }, [open])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    const reflow = () => place()
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', reflow)
    window.addEventListener('scroll', reflow, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('resize', reflow)
      window.removeEventListener('scroll', reflow, true)
    }
  }, [open])

  const openMenu = () => {
    if (disabled) return
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const pick = (o: SelectOption) => {
    onChange(o.value)
    setOpen(false)
    btn.current?.focus()
  }
  // Faol (ochilganda — tanlangan) element ko'rinib tursin; ro'yxat joylashgandan keyin (pos)
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, pos])

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      btn.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) pick(filtered[active])
    }
  }

  const trigger =
    variant === 'filter'
      ? 'h-11 rounded-2xl bg-white pl-4 pr-3 shadow-sm ring-1 ring-slate-200 hover:ring-brand/50'
      : 'h-12 w-full rounded-2xl bg-slate-50 pl-4 pr-3 ring-1 ring-slate-200 hover:bg-white'

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKey}
        className={cx(
          'group flex min-w-0 items-center gap-2.5 text-left text-sm font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60',
          trigger,
          open && 'ring-2 ring-brand',
          className,
        )}
      >
        {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
        <span className={cx('min-w-0 flex-1 truncate', !selected && 'font-semibold text-slate-400')}>{selected?.label ?? placeholder}</span>
        <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition', open ? 'bg-brand/10 text-brand' : 'text-slate-400 group-hover:bg-slate-100')}>
          <ChevronDown className={cx('h-4 w-4 transition', open && 'rotate-180')} />
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            onKeyDown={onKey}
            className="fixed z-[70] flex animate-fade-up flex-col overflow-hidden rounded-2xl bg-white font-sans text-slate-900 shadow-2xl ring-1 ring-black/5"
            style={{
              left: Math.min(pos.left, window.innerWidth - pos.width - 8),
              width: pos.width,
              maxHeight: pos.maxH,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
          >
            {withSearch && (
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    // Telefonda avtomatik fokus klaviaturani ochib ro'yxatni yopadi — faqat sichqonchali qurilmada
                    autoFocus={!window.matchMedia?.('(pointer: coarse)').matches}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setActive(0)
                    }}
                    placeholder="Qidirish…"
                    className="h-10 w-full rounded-xl bg-slate-50 pr-3 pl-9 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
            )}
            <div ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm font-semibold text-slate-400">Hech narsa topilmadi</div>}
              {filtered.map((o, i) => {
                const header = o.group && o.group !== filtered[i - 1]?.group ? o.group : null
                const isSel = o.value === value
                return (
                  <div key={o.value || '__all'}>
                    {header && (
                      <div className="sticky top-0 z-10 mt-1 flex items-center gap-2 bg-white/95 px-2.5 pt-2 pb-1 text-[11px] font-extrabold tracking-wide text-slate-400 uppercase backdrop-blur first:mt-0">
                        {groups?.[header]?.icon}
                        {header}
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      data-idx={i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(o)}
                      className={cx(
                        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition',
                        i === active ? 'bg-brand/8' : '',
                        isSel ? 'font-extrabold text-brand-strong' : 'font-semibold',
                      )}
                    >
                      {o.icon && <span className="shrink-0">{o.icon}</span>}
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.hint && <span className="shrink-0 text-xs font-semibold text-slate-400">{o.hint}</span>}
                      <Check className={cx('h-4 w-4 shrink-0 text-brand', isSel ? 'opacity-100' : 'opacity-0')} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
