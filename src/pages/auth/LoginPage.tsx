// O'qituvchi kirishi (Mini App): login + parol
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogIn } from 'lucide-react'
import { api, USE_MOCK } from '../../api'
import type { LoginResult } from '../../api/contract'
import { isPanelRole } from '../../types'
import { setToken } from '../../lib/auth'
import { haptic, initTelegram, tg } from '../../lib/telegram'
import { useApplyOrg } from '../../lib/org'
import { AuthShell, HowItWorks, PasswordInput } from '../../components/AuthShell'
import { InstallAppCard } from '../../components/InstallApp'
import { Alert, Button, Field, inputClass } from '../../components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  useEffect(() => initTelegram(), [])
  useApplyOrg(undefined) // umumiy Mudarris ko'rinishi

  const finish = ({ token, user }: LoginResult) => {
    haptic('success')
    setToken(token, user.role)
    qc.clear() // oldingi foydalanuvchi ma'lumotlari qolmasin
    const from = (location.state as { from?: string } | null)?.from
    navigate(isPanelRole(user.role) ? '/admin' : from?.startsWith('/app') ? from : '/app', { replace: true })
  }

  const signIn = useMutation({
    mutationFn: () => api.login(login, password),
    onSuccess: finish,
    onError: () => haptic('error'),
  })

  // Telegram ichida ochilgan bo'lsa — avval bog'langan akkaunt bilan avtomatik kirishga urinib ko'ramiz
  // ?manual=1 — ro'yxatdan o'tish sahifasidagi "Login va parolim bor" havolasi
  const manual = new URLSearchParams(location.search).has('manual')
  const [autoLogin, setAutoLogin] = useState(() => Boolean(tg?.initData && api.loginWithTelegram && !manual))
  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  })
  useEffect(() => {
    if (!autoLogin || !api.loginWithTelegram) return
    let cancelled = false
    api
      .loginWithTelegram()
      .then((result) => !cancelled && finishRef.current(result))
      // Bog'lanmagan: Telegram ichida — bot orqali ro'yxatdan o'tish, aks holda oddiy forma
      .catch(() => {
        if (cancelled) return
        if (api.tgStatus) navigate('/join', { replace: true })
        else setAutoLogin(false)
      })
    return () => {
      cancelled = true
    }
  }, [autoLogin, navigate])

  if (autoLogin) {
    return (
      <AuthShell title="Xush kelibsiz" subtitle="Telegram orqali kirilmoqda...">
        <div className="flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Xush kelibsiz"
      subtitle="Bog'cha, maktab yoki akademiya xodimi sifatida kiring"
      footer={
        <>
          <span className="text-tg-hint">
            Hisobingiz yo'qmi?{' '}
            <Link to={tg?.initData && api.tgStatus ? '/join' : '/register'} className="font-extrabold text-brand">
              Ro'yxatdan o'ting
            </Link>
          </span>
          <InstallAppCard className="mt-6" />
          <HowItWorks />
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          signIn.mutate()
        }}
      >
        <Field label="Login">
          <input
            className={inputClass}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="masalan: aziza"
            required
          />
        </Field>
        <Field label="Parol">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••" required />
        </Field>
        {signIn.isError && <Alert>{(signIn.error as Error).message}</Alert>}
        <Button type="submit" size="lg" icon={LogIn} className="w-full" loading={signIn.isPending}>
          Kirish
        </Button>
        {USE_MOCK && (
          <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-xs font-semibold text-amber-900">
            Demo (parol hammasida <b>123456</b>): maktab — <b>aziza</b>, bog'cha — <b>gulnora</b>, akademiya — <b>shahzod</b>. Tasdiq kutayotgan: <b>kamola</b>
          </p>
        )}
      </form>
    </AuthShell>
  )
}
