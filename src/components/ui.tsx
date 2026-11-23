// Umumiy UI komponentlar — Mini App va Rahbariyat paneli ikkalasi ham ishlatadi.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Clock,
  DoorOpen,
  Hourglass,
  Inbox,
  Info,
  Loader2,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { CaseStatus } from '../types'
import { initials, tintOf } from '../lib/colors'
import { isInTelegram, useTelegramBackButton } from '../lib/telegram'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------- Tugma ----------

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'white'
const variants: Record<Variant, string> = {
  primary: 'bg-linear-to-r from-brand to-brand-strong text-white shadow-lg shadow-brand/25 hover:brightness-110',
  secondary: 'bg-slate-500/10 text-tg-text hover:bg-slate-500/15',
  danger: 'bg-linear-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 hover:brightness-110',
  success: 'bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:brightness-110',
  ghost: 'text-brand hover:bg-brand/10',
  white: 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon: Icon,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: LucideIcon
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
        size === 'sm' && 'rounded-xl px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-3 text-sm',
        size === 'lg' && 'px-5 py-4 text-base',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" strokeWidth={2.5} />}
      {children}
    </button>
  )
}

// ---------- Kartochka, belgi, avatar ----------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        // className'da o'z padding'i (p-0, p-5 ...) bo'lsa — standart p-4 qo'shilmaydi
        !/(^|\s)p-\S+/.test(className ?? '') && 'p-4',
        'rounded-3xl bg-tg-bg shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-12px_rgba(30,58,138,0.18)] ring-1 ring-slate-900/5',
        className,
      )}
    >
      {children}
    </div>
  )
}

type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'violet'
const tones: Record<Tone, string> = {
  gray: 'bg-slate-500/10 text-slate-600',
  green: 'bg-emerald-500/12 text-emerald-700',
  amber: 'bg-amber-500/15 text-amber-700',
  red: 'bg-rose-500/12 text-rose-700',
  blue: 'bg-brand/12 text-brand-strong',
  violet: 'bg-violet-500/12 text-violet-700',
}
const dots: Record<Tone, string> = {
  gray: 'bg-slate-400',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
}

export function Badge({ tone = 'gray', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap', tones[tone])}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  )
}

const STATUS: Record<CaseStatus, { text: string; tone: Tone }> = {
  found: { text: 'Topildi', tone: 'green' },
  pending: { text: 'Kutilmoqda', tone: 'amber' },
  not_found: { text: 'Topilmadi', tone: 'red' },
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const s = STATUS[status]
  return (
    <Badge tone={s.tone} dot>
      {s.text}
    </Badge>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={cx(
        'flex shrink-0 items-center justify-center rounded-2xl bg-linear-to-br font-extrabold text-white shadow-md',
        tintOf(name).gradient,
        size === 'sm' && 'h-9 w-9 rounded-xl text-xs',
        size === 'md' && 'h-11 w-11 text-sm',
        size === 'lg' && 'h-14 w-14 text-lg',
      )}
    >
      {initials(name)}
    </div>
  )
}

/** Fan nomi — o'z rangida */
export function SubjectChip({ subject }: { subject: string }) {
  return <span className={cx('inline-flex rounded-lg px-2 py-0.5 text-xs font-bold', tintOf(subject).soft)}>{subject}</span>
}

/** Ikonka + rangli fon (statistika, bo'sh holatlar uchun) */
export function IconTile({ icon: Icon, gradient, size = 'md' }: { icon: LucideIcon; gradient: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={cx(
        'flex shrink-0 items-center justify-center bg-linear-to-br text-white shadow-lg',
        gradient,
        size === 'sm' && 'h-9 w-9 rounded-xl',
        size === 'md' && 'h-12 w-12 rounded-2xl',
        size === 'lg' && 'h-16 w-16 rounded-3xl',
      )}
    >
      <Icon className={size === 'lg' ? 'h-8 w-8' : size === 'md' ? 'h-6 w-6' : 'h-4.5 w-4.5'} strokeWidth={2.2} />
    </div>
  )
}

// ---------- Holatlar: yuklanmoqda / bo'sh / xato ----------

export function LoadingState({ text = 'Yuklanmoqda...' }: { text?: string }) {
  return (
    <div className="space-y-3 py-2" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-3xl bg-slate-400/15" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
      <span className="sr-only">{text}</span>
    </div>
  )
}

export function EmptyState({
  icon = Inbox,
  gradient = 'from-brand to-brand-strong',
  title,
  text,
  action,
}: {
  icon?: LucideIcon
  gradient?: string
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div className="animate-pop-in">
        <IconTile icon={icon} gradient={gradient} size="lg" />
      </div>
      <div className="text-lg font-extrabold">{title}</div>
      {text && <p className="max-w-xs text-sm leading-relaxed text-tg-hint">{text}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      gradient="from-rose-500 to-pink-600"
      title="Xatolik yuz berdi"
      text={error instanceof Error ? error.message : "Iltimos, qayta urinib ko'ring"}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>Qayta urinish</Button>}
    />
  )
}

export function Alert({ tone = 'red', children }: { tone?: 'red' | 'green' | 'amber' | 'blue'; children: ReactNode }) {
  const map = {
    red: { cls: 'bg-rose-500/10 text-rose-800 ring-rose-500/20', Icon: XCircle },
    green: { cls: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20', Icon: CheckCircle2 },
    amber: { cls: 'bg-amber-500/10 text-amber-900 ring-amber-500/25', Icon: Hourglass },
    blue: { cls: 'bg-brand/10 text-blue-800 ring-brand/20', Icon: Info },
  }[tone]
  return (
    <div className={cx('flex gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ring-1', map.cls)}>
      <map.Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

// ---------- Forma ----------

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-tg-hint">{hint}</span>}
    </label>
  )
}

export const inputClass =
  // Telefonda 16px (text-base): kichikroq bo'lsa iPhone maydonga bosilganda ekranni kattalashtirib yuboradi
  'w-full rounded-2xl border-0 bg-slate-500/8 px-4 py-3 text-base sm:text-sm font-medium text-tg-text ring-1 ring-slate-500/15 outline-none transition placeholder:text-tg-hint/70 focus:bg-tg-bg focus:ring-2 focus:ring-brand'

// ---------- Mini App ----------

/**
 * Mini App sahifa sarlavhasi. back berilsa Telegram'ning tepadagi "Orqaga"
 * tugmasi yoqiladi; Telegram'dan tashqarida esa sahifaning o'zida tugma chiqadi.
 */
export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: string; right?: ReactNode }) {
  useTelegramBackButton(Boolean(back))
  return (
    <div className="mb-5 flex items-start gap-3">
      {back && !isInTelegram && (
        <Link to={back} className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-tg-bg shadow-sm ring-1 ring-slate-900/5">
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-tg-hint">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

/** Dars ma'lumotlari — ikonkali kichik bloklar */
export function LessonInfo({ para, time, className, subject, room }: { para: number; time: string; className: string; subject: string; room: string }) {
  const items = [
    { icon: Clock, label: `${para}-para`, value: time },
    { icon: Users, label: 'Sinf', value: className },
    { icon: BookOpen, label: 'Fan', value: subject },
    { icon: DoorOpen, label: 'Xona', value: `${room}-xona` },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2.5 rounded-2xl bg-slate-500/6 px-3 py-2.5">
          <Icon className="h-4 w-4 shrink-0 text-brand" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-tg-hint">{label}</div>
            <div className="truncate text-sm font-bold">{value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Raqamlangan bo'lim sarlavhasi (1. Sana, 2. Darslar ...) */
export function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-brand to-brand-strong text-xs font-extrabold text-white shadow-md shadow-brand/30">
        {n}
      </span>
      <span className="font-extrabold">{title}</span>
    </div>
  )
}
