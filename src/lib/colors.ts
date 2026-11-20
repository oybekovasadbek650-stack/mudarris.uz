// Har bir fan (va har bir odam avatari) uchun barqaror rang.
// Klass nomlari to'liq yozilgan — Tailwind ularni shu fayldan topadi.

export interface Tint {
  soft: string // och fon + matn (chip, katak)
  bar: string // chap chiziq / nuqta
  gradient: string // avatar / kartochka sarlavhasi
  text: string
}

const PALETTE: Tint[] = [
  { soft: 'bg-blue-500/10 text-blue-700', bar: 'bg-blue-500', gradient: 'from-blue-500 to-indigo-500', text: 'text-blue-600' },
  { soft: 'bg-violet-500/10 text-violet-700', bar: 'bg-violet-500', gradient: 'from-violet-500 to-fuchsia-500', text: 'text-violet-600' },
  { soft: 'bg-emerald-500/10 text-emerald-700', bar: 'bg-emerald-500', gradient: 'from-emerald-500 to-teal-500', text: 'text-emerald-600' },
  { soft: 'bg-amber-500/15 text-amber-700', bar: 'bg-amber-500', gradient: 'from-amber-400 to-orange-500', text: 'text-amber-600' },
  { soft: 'bg-rose-500/10 text-rose-700', bar: 'bg-rose-500', gradient: 'from-rose-500 to-pink-500', text: 'text-rose-600' },
  { soft: 'bg-cyan-500/10 text-cyan-700', bar: 'bg-cyan-500', gradient: 'from-cyan-500 to-sky-500', text: 'text-cyan-600' },
  { soft: 'bg-fuchsia-500/10 text-fuchsia-700', bar: 'bg-fuchsia-500', gradient: 'from-fuchsia-500 to-purple-500', text: 'text-fuchsia-600' },
  { soft: 'bg-teal-500/10 text-teal-700', bar: 'bg-teal-500', gradient: 'from-teal-500 to-emerald-500', text: 'text-teal-600' },
]

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export const tintOf = (key: string) => PALETTE[hash(key) % PALETTE.length]

export const initials = (fullName: string) =>
  fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
