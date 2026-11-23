// Jonli yangilanish: ma'lumot o'zgarsa ochiq sahifalarga darhol signal (SSE /api/events).
// Signal ichida ma'lumot yo'q — faqat "o'zgardi"; sahifa o'zi kerakli so'rovlarni qayta yuboradi (ruxsatlar odatdagidek).
// Manbalar: HTTP yozish so'rovlari (routes.ts middleware) va barcha notify.* hodisalari (bot tugmalari, taklif muddati,
// davomat tekshiruvi, ro'yxatdan o'tish) — notify.ts.
type Listener = () => void

const listeners = new Set<Listener>()
let timer: ReturnType<typeof setTimeout> | undefined
/** O'zgarishlar hisoblagichi — SSE o'tmaydigan joyda (masalan Cloudflare tunnel) sahifa shuni tez-tez so'raydi */
let version = Date.now()
export const changeVersion = () => version

export function onChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Bir nechta o'zgarish ketma-ket bo'lsa — bitta signal (150 ms ichida) */
export function emitChange() {
  version++
  if (timer) return
  timer = setTimeout(() => {
    timer = undefined
    for (const fn of listeners) {
      try {
        fn()
      } catch {
        /* uzilgan ulanish */
      }
    }
  }, 150)
}

export const listenerCount = () => listeners.size
