// Uchta tashkilot: har birining nomi, logotipi va so'zlari (bog'chada "tarbiyachi", "guruh", "mashg'ulot").
// Ranglar — src/index.css dagi [data-org=...] bloklarida.
import { useEffect } from 'react'
import type { Org } from '../types'

export interface OrgInfo {
  id: Org
  name: string // to'liq nom
  short: string // menyu/tugmalar uchun
  logo: string
  staff: string // xodim: O'qituvchi / Tarbiyachi
  staffPlural: string
  group: string // Sinf / Guruh
  lesson: string // dars / mashg'ulot
}

export const ORGS: Record<Org, OrgInfo> = {
  school: {
    id: 'school',
    name: 'Mudarris Xususiy Maktabi',
    short: 'Maktab',
    logo: '/logos/school.png',
    staff: "O'qituvchi",
    staffPlural: "O'qituvchilar",
    group: 'Sinf',
    lesson: 'dars',
  },
  academy: {
    id: 'academy',
    name: 'Mudarris Akademiyasi',
    short: 'Akademiya',
    logo: '/logos/academy.png',
    staff: 'Ustoz',
    staffPlural: 'Ustozlar',
    group: 'Guruh',
    lesson: 'dars',
  },
  kindergarten: {
    id: 'kindergarten',
    name: "Mudarris bog'chasi",
    short: "Bog'cha",
    logo: '/logos/kindergarten.png',
    staff: 'Tarbiyachi',
    staffPlural: 'Tarbiyachilar',
    group: 'Guruh',
    lesson: "mashg'ulot",
  },
}

export const ORG_LIST = [ORGS.kindergarten, ORGS.school, ORGS.academy]

/** Sahifa ranglari va shriftini tashkilotga moslaydi (<html data-org="...">) */
export function useApplyOrg(org: Org | undefined) {
  useEffect(() => {
    const root = document.documentElement
    if (org) root.dataset.org = org
    else delete root.dataset.org
  }, [org])
}
