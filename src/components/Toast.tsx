// Qisqa bildirishnomalar ("Saqlandi", "Tasdiqlandi"): ekran pastida chiqadi va 3.5 soniyada yo'qoladi
import { useCallback, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cx } from './ui'
import { ToastContext, type ToastTone as Tone } from '../lib/toast'

interface Item {
  id: number
  tone: Tone
  text: string
}

const STYLE: Record<Tone, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'bg-emerald-600' },
  error: { icon: AlertTriangle, cls: 'bg-rose-600' },
  info: { icon: Info, cls: 'bg-slate-800' },
}

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const remove = useCallback((id: number) => setItems((s) => s.filter((x) => x.id !== id)), [])
  const show = useCallback(
    (text: string, tone: Tone = 'success') => {
      const id = ++seq
      setItems((s) => [...s.slice(-2), { id, tone, text }]) // ko'pi bilan 3 ta
      setTimeout(() => remove(id), 3500)
    },
    [remove],
  )
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
        {items.map((t) => {
          const s = STYLE[t.tone]
          return (
            <div
              key={t.id}
              role="status"
              className={cx('pointer-events-auto flex max-w-sm animate-fade-up items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-2xl', s.cls)}
            >
              <s.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{t.text}</span>
              <button onClick={() => remove(t.id)} className="rounded-lg p-1 opacity-70 hover:bg-white/15 hover:opacity-100" aria-label="Yopish">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
