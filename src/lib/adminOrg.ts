// Rahbariyat paneli: qaysi tashkilot ko'rilyapti (Hammasi / Bog'cha / Maktab / Akademiya)
import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Org } from '../types'

export type OrgFilter = Org | 'all'

export const AdminOrgContext = createContext<{ org: OrgFilter; setOrg: (o: OrgFilter) => void }>({
  org: 'all',
  setOrg: () => {},
})

export const useAdminOrg = () => useContext(AdminOrgContext)

const PREF_KEY = 'admin-org'

export function readOrgPref(): OrgFilter {
  try {
    const v = localStorage.getItem(PREF_KEY)
    if (v === 'school' || v === 'academy' || v === 'kindergarten') return v
  } catch {
    /* localStorage yopiq */
  }
  return 'all'
}

export function writeOrgPref(org: OrgFilter) {
  try {
    localStorage.setItem(PREF_KEY, org)
  } catch {
    /* localStorage yopiq */
  }
}

/** Tanlangan tashkilotdagi filiallar va "shu filial tanlangan tashkilotdami?" tekshiruvi */
export function useOrgBranches() {
  const { org } = useAdminOrg()
  const branches = useQuery({ queryKey: ['branches'], queryFn: api.getBranches })
  const list = (branches.data ?? []).filter((b) => org === 'all' || b.org === org)
  const ids = new Set(list.map((b) => b.id))
  return {
    org,
    branches: list,
    allBranches: branches.data ?? [],
    inOrg: (branchId: string) => org === 'all' || ids.has(branchId),
    branchName: (id: string) => branches.data?.find((b) => b.id === id)?.name ?? '',
  }
}
