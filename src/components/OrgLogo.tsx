// Tashkilot logotiplari (public/logos/*)
import type { Org } from '../types'
import { ORGS } from '../lib/org'
import { cx } from './ui'

export function OrgLogo({ org, className }: { org: Org; className?: string }) {
  const o = ORGS[org]
  return <img src={o.logo} alt={o.name} draggable={false} className={cx('shrink-0 rounded-2xl object-cover shadow-md ring-1 ring-black/5', className)} />
}

/**
 * Umumiy "Mudarris" logotipi (public/logos/mudarris.svg) — uchala tashkilotdan:
 * ochiq kitob (maktab) silueti "M" (bog'cha), o'rtasida pero (akademiya), oltin rang bog'cha sarig'idan.
 * Tashkilot tanlanmagan umumiy sahifalarda ishlatiladi.
 */
export function MudarrisLogo({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <img
      src="/logos/mudarris.svg"
      alt="Mudarris"
      draggable={false}
      className={cx('shrink-0 rounded-[26%] shadow-md ring-1 ring-black/5', className)}
    />
  )
}
