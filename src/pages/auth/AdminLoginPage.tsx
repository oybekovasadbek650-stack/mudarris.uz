// Rahbariyat paneliga kirish (kompyuter)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, LogIn, TrendingUp, UsersRound } from 'lucide-react'
import { MudarrisLogo } from '../../components/OrgLogo'
import { useApplyOrg } from '../../lib/org'
import { api, USE_MOCK } from '../../api'
import { setToken } from '../../lib/auth'
import { isPanelRole } from '../../types'
import { PasswordInput } from '../../components/AuthShell'
import { Alert, Button, Field, inputClass } from '../../components/ui'

const FEATURES = [
  { icon: UsersRound, text: "O'qituvchilar arizalarini tasdiqlash" },
  { icon: CalendarRange, text: 'Dars jadvali va bugungi holat' },
  { icon: TrendingUp, text: "Oylik hisobot va to'lovlar" },
]

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [login, setLogin] = useState('')
  useApplyOrg(undefined)
  const [password, setPassword] = useState('')

  const signIn = useMutation({
    mutationFn: async () => {
      const res = await api.login(login, password)
      if (!isPanelRole(res.user.role)) throw new Error("Bu hisob rahbariyat uchun emas. O'qituvchilar Telegram bot orqali kiradi.")
      return res
    },
    onSuccess: ({ token, user }) => {
      setToken(token, user.role)
      qc.clear()
      navigate('/admin', { replace: true })
    },
  })

  return (
    <div className="grid min-h-dvh font-sans lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-linear-to-br from-brand-dark via-brand-dark to-brand-strong p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand/35 blur-3xl" />
        <div className="absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-brand-accent/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <MudarrisLogo className="h-12 w-12" />
          <div className="text-xl font-extrabold">Mudarris</div>
        </div>
        <div className="relative">
          <h2 className="max-w-md text-4xl leading-tight font-extrabold">Bog'cha, maktab va akademiya — bitta tizimda o'rinbosar</h2>
          <div className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-white/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <span className="font-semibold">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-sm text-white/40">Rahbariyat paneli</div>
      </div>

      <div className="flex items-center justify-center bg-app p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <h1 className="text-3xl font-extrabold">Panelga kirish</h1>
          <p className="mt-1 mb-8 text-sm font-semibold text-slate-500">Rahbariyat yoki filial direktori login va paroli bilan kiring</p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              signIn.mutate()
            }}
          >
            <Field label="Login">
              <input className={`${inputClass} bg-white`} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required />
            </Field>
            <Field label="Parol">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </Field>
            {signIn.isError && <Alert>{(signIn.error as Error).message}</Alert>}
            <Button type="submit" size="lg" icon={LogIn} className="w-full" loading={signIn.isPending}>
              Kirish
            </Button>
            {USE_MOCK && (
              <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-xs font-semibold text-amber-900">
                Demo: <b>admin</b> / <b>admin123</b>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
