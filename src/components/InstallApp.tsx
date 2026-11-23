// "Telefonga o'rnatish" — kartochka (Mini App, kirish sahifasi) yoki ixcham tugma (panel yon menyusi).
// Hech narsa qilib bo'lmasa (allaqachon o'rnatilgan / brauzer qo'llamaydi) — ko'rinmaydi.
import { useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useInstallApp } from '../lib/pwa'
import { Button, cx } from './ui'

export function InstallAppCard({ className }: { className?: string }) {
  const { mode, install } = useInstallApp()
  const [showIos, setShowIos] = useState(false)
  if (!mode) return null
  return (
    <div className={cx('rounded-3xl bg-tg-bg p-4 shadow-sm ring-1 ring-slate-900/5', className)}>
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-2xl shadow-md" />
        <div className="min-w-0 flex-1 text-left">
          <div className="text-sm font-extrabold">Mudarris ilovasi</div>
          <div className="text-xs font-medium text-tg-hint">
            {mode === 'telegram' ? 'Telefon ekraniga belgi — bir bosishda ochiladi' : "Telefonga o'rnating — ilova kabi alohida ochiladi"}
          </div>
        </div>
        <Button size="sm" icon={mode === 'ios' ? Share : Download} onClick={() => (mode === 'ios' ? setShowIos(true) : void install())}>
          O'rnatish
        </Button>
      </div>
      {showIos && <IosHelp onClose={() => setShowIos(false)} />}
    </div>
  )
}

/** Panel yon menyusi uchun (to'q fonda) */
export function InstallAppButton() {
  const { mode, install } = useInstallApp()
  const [showIos, setShowIos] = useState(false)
  if (!mode) return null
  return (
    <>
      <button
        type="button"
        onClick={() => (mode === 'ios' ? setShowIos(true) : void install())}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-extrabold text-white ring-1 ring-white/15 transition hover:bg-white/15"
      >
        <Download className="h-4 w-4" /> Ilovani o'rnatish
      </button>
      {showIos && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center" onClick={() => setShowIos(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-slate-900" onClick={(e) => e.stopPropagation()}>
            <IosHelp onClose={() => setShowIos(false)} />
          </div>
        </div>
      )}
    </>
  )
}

/** iPhone: Apple o'rnatish tugmasini bermaydi — 2 qadamlik ko'rsatma */
function IosHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-3 rounded-2xl bg-brand/8 p-4 text-left text-sm">
      <div className="mb-2 flex items-center justify-between">
        <b className="font-extrabold">iPhone'ga o'rnatish</b>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-tg-hint" aria-label="Yopish">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="space-y-2 font-medium">
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-extrabold text-white">1</span>
          Safari pastidagi <Share className="inline h-4 w-4 text-brand" /> <b>Ulashish</b> tugmasini bosing
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-extrabold text-white">2</span>
          <SquarePlus className="inline h-4 w-4 text-brand" /> <b>«Ekranga qo'shish»</b> (Add to Home Screen)
        </li>
      </ol>
    </div>
  )
}
