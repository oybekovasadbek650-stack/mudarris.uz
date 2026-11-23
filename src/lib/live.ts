// Jonli yangilanish: server ma'lumot o'zgarganini aytsa, ochiq sahifadagi so'rovlar qayta yuklanadi — Ctrl+R kerak emas
// (bot orqali tasdiq, yangi xodim, taklifga javob va h.k. darhol ko'rinadi).
//  1) Asosiy yo'l: SSE /api/events — o'zgarish bo'lishi bilan signal.
//  2) Zaxira: SSE 4 soniyada ulanmasa (masalan Cloudflare tunnel oqimni ushlab qoladi) — har 3 soniyada /api/changes
//     hisoblagichini so'raydi (juda kichik so'rov), o'zgargan bo'lsa yangilaydi.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { USE_MOCK } from '../api'
import { getToken } from './auth'

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const POLL_MS = 3_000

export function useLiveUpdates() {
  const qc = useQueryClient()
  const { pathname } = useLocation()
  // /admin... — panel tokeni, qolgani — ustoz tokeni (lib/auth)
  const token = USE_MOCK ? null : getToken(pathname.startsWith('/admin') ? 'admin' : 'teacher')

  useEffect(() => {
    if (!token) return
    let closed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let poll: ReturnType<typeof setInterval> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void qc.invalidateQueries(), 200)
    }

    // Zaxira: hisoblagichni so'rash
    let lastVersion: number | undefined
    const startPolling = () => {
      if (poll || closed) return
      const check = async () => {
        if (document.hidden) return // yashirin oynada so'ramaymiz
        try {
          const r = await fetch(`${BASE}/changes`, { headers: { Authorization: `Bearer ${token}` } })
          if (!r.ok) return
          const { v } = (await r.json()) as { v: number }
          if (lastVersion !== undefined && v !== lastVersion) refresh()
          lastVersion = v
        } catch {
          /* tarmoq vaqtincha yo'q */
        }
      }
      void check()
      poll = setInterval(check, POLL_MS)
    }

    let es: EventSource | undefined
    let ready = false
    if (typeof EventSource !== 'undefined') {
      es = new EventSource(`${BASE}/events?token=${encodeURIComponent(token)}`)
      es.addEventListener('change', refresh)
      es.addEventListener('ready', () => {
        // Qayta ulanishda orada o'tkazib yuborilgan o'zgarishlar ham ko'rinsin
        if (ready) refresh()
        ready = true
      })
    }
    // SSE 4 soniyada kelmasa — zaxira yo'lga o'tamiz
    const fallback = setTimeout(() => {
      if (!ready) {
        es?.close()
        startPolling()
      }
    }, 4_000)

    return () => {
      closed = true
      clearTimeout(timer)
      clearTimeout(fallback)
      clearInterval(poll)
      es?.close()
    }
  }, [token, qc])
}
