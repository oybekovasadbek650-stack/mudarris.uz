// Tashkilot logotiplari (public/logos/*.png)
import type { Org } from '../types'
import { ORG_LIST, ORGS } from '../lib/org'
import { cx } from './ui'

export function OrgLogo({ org, className }: { org: Org; className?: string }) {
  const o = ORGS[org]
  return <img src={o.logo} alt={o.name} draggable={false} className={cx('shrink-0 rounded-2xl object-cover shadow-md ring-1 ring-black/5', className)} />
}

/** Uchala logotip yonma-yon (umumiy sahifalar uchun) */
export function OrgLogoStack({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <div className="flex -space-x-3">
      {ORG_LIST.map((o) => (
        <OrgLogo key={o.id} org={o.id} className={cx(className, 'ring-2 ring-white')} />
      ))}
    </div>
  )
}
