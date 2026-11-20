// O'qituvchi kirishi (Mini App): login + parol
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogIn } from 'lucide-react'
import { api, USE_MOCK } from '../../api'
import { setToken } from '../../lib/auth'
import { haptic, initTelegram } from '../../lib/telegram'
import { useApplyOrg } from '../../lib/org'
import { AuthShell, PasswordInput } from '../../components/AuthShell'
import { Alert, Button, Field, inputClass } from '../../components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  useEffect(() => initTelegram(), [])
  useApplyOrg(undefined) // umumiy Mudarris ko'rinishi

  const signIn = useMutation({
    mutationFn: () => api.login(login, password),
    onSuccess: ({ token, user }) => {
      haptic('success')
      setToken(token, user.role)
      qc.clear() // oldingi foydalanuvchi ma'lumotlari qolmasin
      const from = (location.state as { from?: string } | null)?.from
      navigate(user.role === 'admin' ? '/admin' : from?.startsWith('/app') ? from : '/app', { replace: true })
    },
    onError: () => haptic('error'),
  })

  return (
    <AuthShell
      title="Xush kelibsiz"
      subtitle="Bog'cha, maktab yoki akademiya xodimi sifatida kiring"
      footer={
        <span className="text-tg-hint">
          Hisobingiz yo'qmi?{' '}
          <Link to="/register" className="font-extrabold text-brand">
            Ro'yxatdan o'ting
          </Link>
        </span>
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
