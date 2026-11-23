// Ilovani telefonga o'rnatish (PWA). Uch holat:
//  - Android / kompyuter Chrome: brauzerning "beforeinstallprompt" hodisasi -> bitta tugma bilan o'rnatiladi;
//  - iPhone Safari: Apple tugma bermaydi -> "Ulashish -> Ekranga qo'shish" ko'rsatmasi;
//  - Telegram Mini App ichida (Bot API 8.0+): tg.addToHomeScreen() — Mini App belgisi telefon ekraniga qo'shiladi.
import { useEffect, useState } from 'react'
import { isInTelegram, tg } from './telegram'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const subscribers = new Set<() => void>()
const notifyAll = () => subscribers.forEach((fn) => fn())

/** main.tsx chaqiradi: service worker va o'rnatish hodisasini ushlash */
export function initPwa() {
  if ('serviceWorker' in navigator && !isInTelegram) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // o'z tugmamiz bilan ko'rsatamiz
    deferred = e as InstallPromptEvent
    notifyAll()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notifyAll()
  })
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

export type InstallMode = 'prompt' | 'ios' | 'telegram' | null

export function useInstallApp() {
  const [, force] = useState(0)
  const [tgAdded, setTgAdded] = useState(false)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    subscribers.add(fn)
    return () => {
      subscribers.delete(fn)
    }
  }, [])
  // Telegram: allaqachon qo'shilganmi
  useEffect(() => {
    if (!isInTelegram || !tg?.checkHomeScreenStatus) return
    try {
      tg.checkHomeScreenStatus((s) => setTgAdded(s === 'added' || s === 'unsupported'))
    } catch {
      /* eski Telegram */
    }
  }, [])

  let mode: InstallMode = null
  if (isInTelegram) {
    if (tg?.addToHomeScreen && tg.isVersionAtLeast?.('8.0') && !tgAdded) mode = 'telegram'
  } else if (!isStandalone()) {
    if (deferred) mode = 'prompt'
    else if (isIos()) mode = 'ios'
  }

  const install = async () => {
    if (mode === 'telegram') tg?.addToHomeScreen?.()
    if (mode === 'prompt' && deferred) {
      await deferred.prompt()
      await deferred.userChoice.catch(() => null)
      deferred = null
      notifyAll()
    }
  }
  return { mode, install }
}
