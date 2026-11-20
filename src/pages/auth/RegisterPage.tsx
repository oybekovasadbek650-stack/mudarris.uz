// O'qituvchi o'zi ro'yxatdan o'tadi -> ariza "tasdiq kutilmoqda" -> admin tasdiqlaydi
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Clock3, Plus, UserPlus } from 'lucide-react'
import { api } from '../../api'
import { haptic, initTelegram } from '../../lib/telegram'
import { ORG_LIST, useApplyOrg } from '../../lib/org'
import { AuthShell, PasswordInput } from '../../components/AuthShell'
import { Alert, Button, EmptyState, Field, cx, inputClass } from '../../components/ui'

const SUBJECTS = [
  'Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Adabiyot',
  'Ingliz tili', 'Rus tili', 'Tarix', 'Geografiya', 'Informatika', 'Jismoniy tarbiya',
]

export default function RegisterPage() {
  useEffect(() => initTelegram(), [])
  const branches = useQuery({ queryKey: ['branches'], queryFn: api.getBranches })
  const [form, setForm] = useState({ fullName: '', phone: '+998 ', branchId: '', login: '', password: '', password2: '' })
  const branchId = form.branchId
  const org = branches.data?.find((b) => b.id === branchId)?.org
  useApplyOrg(org) // tanlangan filial tashkiloti dizayni darhol ko'rinadi
  const [subjects, setSubjects] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [localError, setLocalError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setLocalError('')
    setForm({ ...form, [k]: e.target.value })
  }
  const toggleSubject = (s: string) => setSubjects((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]))
  const addCustom = () => {
    const s = custom.trim()
    if (s && !subjects.includes(s)) setSubjects([...subjects, s])
    setCustom('')
  }

  const register = useMutation({
    mutationFn: () =>
      api.register({
        fullName: form.fullName,
        phone: form.phone,
        branchId,
        subjects,
        login: form.login,
        password: form.password,
      }),
    onSuccess: () => haptic('success'),
    onError: () => haptic('error'),
  })

  if (register.isSuccess) {
    return (
      <AuthShell title="Ariza yuborildi" subtitle="Deyarli tayyor" org={org}>
        <EmptyState
          icon={Clock3}
          gradient="from-amber-400 to-orange-500"
          title="Tasdiq kutilmoqda"
          text={`Rahbariyat arizangizni ko'rib chiqib tasdiqlagach, "${form.login.trim().toLowerCase()}" login va parolingiz bilan kira olasiz.`}
          action={
            <Link to="/login" className="font-extrabold text-brand">
              Kirish sahifasiga
            </Link>
          }
        />
      </AuthShell>
    )
  }

  const visibleSubjects = [...SUBJECTS, ...subjects.filter((s) => !SUBJECTS.includes(s))]

  return (
    <AuthShell
      org={org}
      title="Ro'yxatdan o'tish"
      subtitle="Ma'lumotlaringizni kiriting — rahbariyat tasdiqlaydi"
      footer={
        <span className="text-tg-hint">
          Hisobingiz bormi?{' '}
          <Link to="/login" className="font-extrabold text-brand">
            Kirish
          </Link>
        </span>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (form.password !== form.password2) return setLocalError('Parollar bir xil emas')
          register.mutate()
        }}
      >
        <Field label="Ism-familiya">
          <input className={inputClass} value={form.fullName} onChange={set('fullName')} placeholder="Aziza Karimova" autoComplete="name" required />
        </Field>
        <Field label="Telefon raqam">
          <input className={inputClass} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" required />
        </Field>
        <Field label="Qayerda ishlaysiz?" hint="Bog'cha, maktab yoki akademiya filialini tanlang">
          <select className={inputClass} value={branchId} onChange={set('branchId')}>
            <option value="" disabled>Tanlang...</option>
            {ORG_LIST.map((o) => (
              <optgroup key={o.id} label={o.name}>
                {branches.data?.filter((b) => b.org === o.id).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-bold">Qaysi fanlardan dars berasiz?</span>
          <div className="flex flex-wrap gap-2">
            {visibleSubjects.map((s) => {
              const on = subjects.includes(s)
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleSubject(s)}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition',
                    on ? 'bg-brand text-white shadow-md shadow-brand/30' : 'bg-slate-500/10 text-tg-text',
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  {s}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
              placeholder="Boshqa fan..."
            />
            <Button type="button" variant="secondary" icon={Plus} onClick={addCustom} disabled={!custom.trim()}>
              Qo'shish
            </Button>
          </div>
        </div>

        <div className="border-t border-slate-500/10 pt-4">
          <Field label="Login" hint="4–20 ta lotin harfi yoki raqam. Kirishda shu ishlatiladi.">
            <input className={inputClass} value={form.login} onChange={set('login')} autoComplete="username" autoCapitalize="none" placeholder="masalan: aziza" required />
          </Field>
        </div>
        <Field label="Parol" hint="Kamida 6 ta belgi">
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" required />
        </Field>
        <Field label="Parolni takrorlang">
          <PasswordInput value={form.password2} onChange={set('password2')} autoComplete="new-password" required />
        </Field>

        {(localError || register.isError) && <Alert>{localError || (register.error as Error).message}</Alert>}

        <Button type="submit" size="lg" icon={UserPlus} className="w-full" loading={register.isPending}>
          Ro'yxatdan o'tish
        </Button>
      </form>
    </AuthShell>
  )
}
