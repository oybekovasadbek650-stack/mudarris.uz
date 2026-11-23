// Vaqt: hamma hisob Toshkent vaqtida (UTC+5, yozgi vaqt yo'q).
// Testlarda "hozir"ni almashtirish uchun clock.now ni o'zgartirish mumkin.
export const clock = { now: () => new Date() }

const TZ_OFFSET_MIN = 5 * 60

/** Toshkent bo'yicha hozirgi sana va vaqt: { date: "2026-11-22", time: "07:30" } */
export function localNow(now: Date = clock.now()) {
  const t = new Date(now.getTime() + TZ_OFFSET_MIN * 60_000)
  const iso = t.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** Toshkentdagi sana va vaqtdan Date yasaydi (testlar uchun) */
export function tashkent(date: string, time = '00:00'): Date {
  return new Date(Date.parse(`${date}T${time}:00Z`) - TZ_OFFSET_MIN * 60_000)
}

/** 1 = Dushanba ... 7 = Yakshanba */
export function weekdayOf(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export const isISODate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

export const isMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}$/.test(s)

export const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
