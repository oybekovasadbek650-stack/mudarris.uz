// Telegram Mini App bilan ishlash uchun yordamchilar.
// Skript index.html da ulangan: https://telegram.org/js/telegram-web-app.js
// Oddiy brauzerda ochilganda ham hammasi xatosiz ishlaydi (shunchaki hech narsa qilmaydi).
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface TgWebApp {
  initData: string
  initDataUnsafe: { start_param?: string; user?: { id: number; first_name: string } }
  ready(): void
  expand(): void
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
  HapticFeedback?: { notificationOccurred(type: 'success' | 'error' | 'warning'): void }
}

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp }
  }
}

export const tg: TgWebApp | undefined = window.Telegram?.WebApp

/** Haqiqatan Telegram ichida ochilganmi */
export const isInTelegram = Boolean(tg?.initData)

export function initTelegram() {
  tg?.ready()
  tg?.expand()
}

/** Bot tugmasidagi parametr: t.me/bot/app?startapp=case_123 -> "case_123" */
export const startParam = () => tg?.initDataUnsafe.start_param

export function haptic(type: 'success' | 'error' | 'warning') {
  tg?.HapticFeedback?.notificationOccurred(type)
}

/** Telegram'ning tepadagi "Orqaga" tugmasini yoqadi */
export function useTelegramBackButton(enabled: boolean) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!tg || !enabled) return
    const back = () => navigate(-1)
    tg.BackButton.show()
    tg.BackButton.onClick(back)
    return () => {
      tg.BackButton.offClick(back)
      tg.BackButton.hide()
    }
  }, [enabled, navigate])
}
