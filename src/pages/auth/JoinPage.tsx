// Mini App ochildi, lekin xodim hali ro'yxatdan o'tmagan.
// Ro'yxat bot CHATINING o'zida bo'ladi (server/src/botRegister.ts): bu sahifa botga "savollarni boshla" deydi
// va ilovani yopib, ustozni chatga qaytaradi. Ariza kutilayotgan bo'lsa — kutish ekrani.
import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, MessageCircle, Send } from 'lucide-react'
import { api } from '../../api'
import type { TgStatus } from '../../api/contract'
import { setToken } from '../../lib/auth'
import { haptic, initTelegram, isInTelegram, tg } from '../../lib/telegram'
import { AuthShell } from '../../components/AuthShell'
import { Alert, Button, EmptyState, LoadingState } from '../../components/ui'

const closeApp = () => tg?.close?.()

export default function JoinPage() {
  useEffect(() => initTelegram(), [])
  const navigate = useNavigate()
  const qc = useQueryClient()
  const inTg = isInTelegram && Boolean(api.tgStatus)
  const status = useQuery({ queryKey: ['tg-status'], queryFn: () => api.tgStatus!(), enabled: inTg, retry: 1 })

  // Ro'yxatdan o'tmagan — bot chatda savollarni boshlaydi, ilova bir zumda yopiladi
  const start = useMutation({
    mutationFn: () => api.tgChatRegister!(),
    onSuccess: () => {
      haptic('success')
      setTimeout(closeApp, 1800)
    },
  })
  const needsChat = status.data?.status === 'none' || status.data?.status === 'rejected'
  const started = useRef(false)
  useEffect(() => {
    if (!needsChat || started.current) return
    started.current = true
    start.mutate()
  }, [needsChat, start])

  // Tasdiqlangan — to'g'ridan-to'g'ri ilovaga
  const active = status.data?.status === 'active'
  useEffect(() => {
    if (!active || !api.loginWithTelegram) return
    api.loginWithTelegram().then(({ token }) => {
      setToken(token, 'teacher')
      qc.clear()
      navigate('/app', { replace: true })
    }, () => {})
  }, [active, navigate, qc])

  if (!inTg) {
    return (
      <AuthShell title="Ro'yxatdan o'tish" subtitle="Telegram bot orqali">
        <EmptyState
          icon={Send}
          gradient="from-brand to-brand-strong"
          title="Botda ro'yxatdan o'ting"
          text="Telegram'da @mudarris_orinbosar_bot ni oching va /start bosing — bot bir nechta savol beradi."
          action={<Link to="/register" className="font-extrabold text-brand">Brauzerda ro'yxatdan o'tish</Link>}
        />
      </AuthShell>
    )
  }
  if (status.isLoading || active) {
    return (
      <AuthShell title="Xush kelibsiz" subtitle="Bir soniya...">
        <LoadingState />
      </AuthShell>
    )
  }
  if (status.isError) {
    return (
      <AuthShell title="Ro'yxatdan o'tish" subtitle="Xato">
        <Alert>{(status.error as Error).message}</Alert>
      </AuthShell>
    )
  }
  if (status.data?.status === 'pending') return <Pending status={status.data} />

  return (
    <AuthShell title="Ro'yxatdan o'tish" subtitle="Bot chatida — 5 ta oddiy savol">
      <EmptyState
        icon={MessageCircle}
        gradient="from-brand to-brand-strong"
        title={start.isSuccess ? 'Bot sizga savol yubordi' : 'Bir soniya...'}
        text="Ro'yxatdan o'tish bot chatining o'zida: ism, telefon, muassasa, filial va fan. Chatga qayting va savollarga javob bering."
      />
      {start.isError && <Alert>{(start.error as Error).message}</Alert>}
      <Button type="button" size="lg" className="mt-2 w-full" icon={Send} loading={start.isPending} onClick={closeApp}>
        Chatga qaytish
      </Button>
      <Link to="/login?manual=1" className="mt-4 block text-center text-xs font-bold text-tg-hint">
        Login va parolim bor — kirish
      </Link>
    </AuthShell>
  )
}

function Pending({ status }: { status: TgStatus }) {
  return (
    <AuthShell title="Ariza yuborildi" subtitle="Deyarli tayyor">
      <EmptyState
        icon={Clock3}
        gradient="from-amber-400 to-orange-500"
        title="Direktor tasdiqlashi kutilmoqda"
        text="Tasdiqlanishi bilan bot chatiga xabar keladi — parolingiz ham o'sha yerda bo'ladi."
      />
      {status.login && (
        <div className="mt-2 rounded-2xl bg-brand/8 px-4 py-3 text-center text-sm">
          <span className="text-tg-hint">Loginingiz: </span>
          <b className="font-extrabold text-brand-strong">{status.login}</b>
        </div>
      )}
      {tg?.close && (
        <Button type="button" variant="secondary" size="lg" className="mt-4 w-full" icon={Send} onClick={closeApp}>
          Chatga qaytish
        </Button>
      )}
    </AuthShell>
  )
}
