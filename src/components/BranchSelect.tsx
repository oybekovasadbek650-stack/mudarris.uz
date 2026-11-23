// Filial tanlash: tashkilot bo'yicha guruhlangan (logolari bilan), alifbo tartibida, qidiruvli
import type { Branch } from '../types'
import { ORG_LIST, ORGS } from '../lib/org'
import { MudarrisLogo, OrgLogo } from './OrgLogo'
import { Select, type SelectGroupMeta, type SelectOption } from './Select'

export function BranchSelect({
  value,
  onChange,
  branches,
  allLabel,
  variant = 'filter',
  placeholder = 'Filialni tanlang…',
  ariaLabel = 'Filial',
  hint,
  className,
}: {
  value: string
  onChange: (id: string) => void
  branches: Branch[]
  /** Berilsa — ro'yxat boshida "hammasi" varianti (qiymati '') */
  allLabel?: string
  variant?: 'filter' | 'field'
  placeholder?: string
  ariaLabel?: string
  /** Har filial yonida kichik matn (masalan "2 alohida") */
  hint?: (b: Branch) => string | undefined
  className?: string
}) {
  const options: SelectOption[] = []
  if (allLabel) options.push({ value: '', label: allLabel, icon: <MudarrisLogo className="h-6 w-6 rounded-md shadow-none" /> })
  const groups: SelectGroupMeta = {}
  for (const o of ORG_LIST) {
    const list = branches.filter((b) => b.org === o.id).sort((a, b) => a.name.localeCompare(b.name, 'uz'))
    if (list.length === 0) continue
    const group = ORGS[o.id].name
    groups[group] = { icon: <OrgLogo org={o.id} className="h-4 w-4 rounded shadow-none" /> }
    for (const b of list) {
      options.push({ value: b.id, label: b.name, group, icon: <OrgLogo org={b.org} className="h-6 w-6 rounded-md shadow-none" />, hint: hint?.(b) })
    }
  }
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      groups={groups}
      variant={variant}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className={className}
    />
  )
}
