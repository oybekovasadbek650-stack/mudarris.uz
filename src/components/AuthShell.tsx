// Kirish / ro'yxatdan o'tish sahifalari uchun umumiy ramka va parol maydoni
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { CalendarX2, Eye, EyeOff, Send, ShieldCheck } from 'lucide-react'
import type { Org } from '../types'
import { ORGS } from '../lib/org'
import { OrgLogo, MudarrisLogo } from './OrgLogo'
import { cx, inputClass } from './ui'

const STEPS = [
  { icon: CalendarX2, title: 'Kela olmayman', text: 'Ustoz bir necha bosishda ariza yuboradi' },
  { icon: Send, title: 'Bot taklif yuboradi', text: "Bo'sh va fani mos ustozlarga — Telegram'da" },
  { icon: ShieldCheck, title: 'Direktor tasdiqlaydi', text: "Dars o'rinbosarsiz qolmaydi" },
]

/** Kirish sahifasi ostida: tizim qanday ishlaydi (3 qadam) */
export function HowItWorks() {
  return (
    <div className="mt-8">
      <div className="mb-3 text-center text-xs font-extrabold tracking-wide text-tg-hint uppercase">Qanday ishlaydi</div>
      <div className="space-y-2 text-left">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-center gap-3 rounded-2xl bg-tg-bg/70 p-3 ring-1 ring-slate-900/5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand to-brand-strong text-white shadow-md shadow-brand/25">
              <s.icon className="h-5 w-5" />
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-brand-strong shadow">{i + 1}</span>
            </div>
            <div>
              <div className="text-sm font-extrabold">{s.title}</div>
              <div className="text-xs font-medium text-tg-hint">{s.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AuthShell({ title, subtitle, children, footer, org }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode; org?: Org }) {
  return (
    <div className="min-h-dvh bg-tg-secondary font-sans text-tg-text">
      <div className="relative overflow-hidden bg-linear-to-br from-brand via-brand to-brand-strong px-6 pt-12 pb-24 text-white">
        <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/15 blur-sm" />
        <div className="absolute -bottom-20 left-6 h-44 w-44 rounded-full bg-brand-accent/40 blur-2xl" />
        <div className="relative mx-auto max-w-md">
          <div className="mb-5 flex items-center gap-3">
            {org ? <OrgLogo org={org} className="h-14 w-14" /> : <MudarrisLogo className="h-12 w-12" />}
            <div className="text-sm leading-tight font-extrabold text-white/90">{org ? ORGS[org].name : 'Mudarris'}<br /><span className="font-semibold text-white/60">O'rinbosar tizimi</span></div>
          </div>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm font-medium text-white/80">{subtitle}</p>
        </div>
      </div>
      <div className="relative mx-auto -mt-14 max-w-md px-4 pb-10">
        <div className="animate-fade-up rounded-[28px] bg-tg-bg p-6 shadow-[0_20px_50px_-20px_rgba(30,58,138,0.35)] ring-1 ring-slate-900/5">
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
  )
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={cx(inputClass, 'pr-12')} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xl p-2 text-tg-hint hover:text-tg-text"
        aria-label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"}
      >
        {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
      </button>
    </div>
  )
}
