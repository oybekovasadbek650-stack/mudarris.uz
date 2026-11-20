// Kirish / ro'yxatdan o'tish sahifalari uchun umumiy ramka va parol maydoni
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { Org } from '../types'
import { ORGS } from '../lib/org'
import { OrgLogo, OrgLogoStack } from './OrgLogo'
import { cx, inputClass } from './ui'

export function AuthShell({ title, subtitle, children, footer, org }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode; org?: Org }) {
  return (
    <div className="min-h-dvh bg-tg-secondary font-sans text-tg-text">
      <div className="relative overflow-hidden bg-linear-to-br from-brand via-brand to-brand-strong px-6 pt-12 pb-24 text-white">
        <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/15 blur-sm" />
        <div className="absolute -bottom-20 left-6 h-44 w-44 rounded-full bg-brand-accent/40 blur-2xl" />
        <div className="relative mx-auto max-w-md">
          <div className="mb-5 flex items-center gap-3">
            {org ? <OrgLogo org={org} className="h-14 w-14" /> : <OrgLogoStack className="h-12 w-12" />}
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
