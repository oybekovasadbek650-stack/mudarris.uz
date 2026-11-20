export const WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
export const WEEKDAYS_SHORT = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']
export const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
]

const pad = (n: number) => String(n).padStart(2, '0')

/** Date -> "2026-11-20" (mahalliy vaqt bo'yicha) */
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISO(new Date())

export const addDays = (s: string, n: number) => {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 1 = Dushanba ... 7 = Yakshanba */
export const weekdayOf = (s: string) => {
  const w = fromISO(s).getDay()
  return w === 0 ? 7 : w
}

/** "20-noyabr, Juma" */
export const formatDate = (s: string) => {
  const d = fromISO(s)
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${WEEKDAYS[weekdayOf(s) - 1]}`
}

/** "2026-11" -> "Noyabr 2026" */
export const formatMonth = (m: string) => {
  const [y, mm] = m.split('-').map(Number)
  const name = MONTHS[mm - 1]
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`
}

export const formatMoney = (n: number) =>
  `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`
