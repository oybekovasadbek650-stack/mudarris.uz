// Filiallar (faqat umumiy rahbariyat): filial qo'shish/tahrirlash va har filialga direktor tayinlash
import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Building2, Check, KeyRound, Pencil, Plus, Send, UserCog, UsersRound, X } from 'lucide-react'
import { api } from '../../api'
import type { AdminBranch, Org } from '../../types'
import { ORG_LIST, ORGS } from '../../lib/org'
import { OrgLogo } from '../../components/OrgLogo'
import { PasswordInput } from '../../components/AuthShell'
import { Alert, Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, inputClass } from '../../components/ui'
import { useToast } from '../../lib/toast'
import { AdminHeader } from './AdminLayout'

function Modal({ title, subtitle, icon: Icon, onClose, children }: { title: string; subtitle?: string; icon: typeof Building2; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg animate-fade-up overflow-hidden rounded-[28px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 bg-linear-to-r from-brand via-brand to-brand-strong px-6 py-5 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold">{title}</h2>
            {subtitle && <div className="truncate text-xs font-semibold text-white/70">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/15" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function BranchForm({ branch, onClose }: { branch?: AdminBranch; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(branch?.name ?? '')
  const [org, setOrg] = useState<Org>(branch?.org ?? 'school')
  const save = useMutation({
    mutationFn: () => (branch ? api.updateBranch(branch.id, { name, org }) : api.createBranch({ name, org })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast(branch ? 'Filial saqlandi' : "Filial qo'shildi")
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  return (
    <Modal title={branch ? 'Filialni tahrirlash' : "Yangi filial"} icon={Building2} onClose={onClose}>
      <form className="space-y-4 p-6" onSubmit={submit}>
        <Field label="Tashkilot turi">
          <div className="grid grid-cols-3 gap-2">
            {ORG_LIST.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOrg(o.id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs font-extrabold ring-2 transition ${
                  org === o.id ? 'bg-brand/8 ring-brand' : 'bg-slate-50 ring-transparent hover:ring-slate-200'
                }`}
              >
                <OrgLogo org={o.id} className="h-9 w-9 rounded-xl shadow-none" />
                {o.short}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Filial nomi" hint="Masalan: Chilonzor filiali">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={80} autoFocus />
        </Field>
        {save.isError && <Alert>{(save.error as Error).message}</Alert>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="white" onClick={onClose}>Bekor qilish</Button>
          <Button type="submit" loading={save.isPending}>{branch ? 'Saqlash' : "Qo'shish"}</Button>
        </div>
      </form>
    </Modal>
  )
}

function DirectorForm({ branch, onClose }: { branch: AdminBranch; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const d = branch.director
  const [form, setForm] = useState({ fullName: d?.fullName ?? '', phone: d?.phone ?? '+998 ', login: d?.login ?? '', password: '' })
  const save = useMutation({
    mutationFn: () =>
      api.saveDirector(branch.id, {
        ...form,
        phone: form.phone.replace(/\s/g, '') === '+998' ? '' : form.phone.trim(), // faqat prefiks — raqam kiritilmagan
        password: form.password || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
      toast(d ? 'Direktor saqlandi' : 'Direktor tayinlandi')
      onClose()
    },
  })
  return (
    <Modal title={d ? 'Direktorni tahrirlash' : 'Direktor tayinlash'} subtitle={branch.name} icon={UserCog} onClose={onClose}>
      <form
        className="space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <Field label="Ism-familiya">
          <input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required autoFocus />
        </Field>
        <Field label="Telefon">
          <input className={inputClass} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Login" hint="4–20 ta lotin harfi yoki raqam">
            <input className={inputClass} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase() })} autoCapitalize="none" autoComplete="off" required />
          </Field>
          <Field label={d ? 'Yangi parol' : 'Parol'} hint={d ? "O'zgartirmasangiz bo'sh qoldiring" : 'Kamida 6 ta belgi'}>
            <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required={!d} minLength={d ? undefined : 6} />
          </Field>
        </div>
        <Alert tone="blue">
          Login va parolni direktorga bering. U panelga kiradi va faqat o'z filialini ko'radi. «Telegram'ni ulash» tugmasi orqali botni ulasa, tasdiqlash so'rovlari telefoniga keladi.
        </Alert>
        {save.isError && <Alert>{(save.error as Error).message}</Alert>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="white" onClick={onClose}>Bekor qilish</Button>
          <Button type="submit" loading={save.isPending}>Saqlash</Button>
        </div>
      </form>
    </Modal>
  )
}

function BranchCard({ b, onEdit, onDirector }: { b: AdminBranch; onEdit: () => void; onDirector: () => void }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <OrgLogo org={b.org} className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-extrabold">{b.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <UsersRound className="h-3.5 w-3.5" /> {b.teachersCount} ta faol {ORGS[b.org].staffPlural.toLowerCase()}
          </div>
        </div>
        <button onClick={onEdit} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Filialni tahrirlash" title="Filialni tahrirlash">
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {b.director ? (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <Avatar name={b.director.fullName} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold">{b.director.fullName}</div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1"><KeyRound className="h-3 w-3" /> {b.director.login}</span>
              {b.director.phone && <span>{b.director.phone}</span>}
            </div>
          </div>
          {b.director.telegramLinked ? (
            <Badge tone="blue" dot>Telegram</Badge>
          ) : (
            <span title="Direktor hali Telegram'ni ulamagan — bot xabarlari bormaydi">
              <Badge tone="gray">Telegram yo'q</Badge>
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl bg-amber-400/15 px-3.5 py-3 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Direktor tayinlanmagan
        </div>
      )}

      <Button variant={b.director ? 'white' : 'primary'} icon={b.director ? UserCog : Plus} onClick={onDirector} className="w-full">
        {b.director ? 'Direktorni tahrirlash' : 'Direktor tayinlash'}
      </Button>
    </Card>
  )
}

/** Botda "Filial direktori" lavozimini tanlab ro'yxatdan o'tganlar — tasdiqlansa shu filial direktori bo'ladi */
function DirectorRequests() {
  const qc = useQueryClient()
  const toast = useToast()
  const query = useQuery({ queryKey: ['director-requests'], queryFn: api.getDirectorRequests })
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.decideDirectorRequest(id, approve),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['director-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
      toast(v.approve ? 'Direktor tayinlandi — login va parol unga botda yuborildi' : 'Ariza rad etildi')
    },
  })
  const list = query.data ?? []
  if (list.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
        Direktorlik arizalari
        <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-extrabold text-white">{list.length}</span>
      </h2>
      <p className="mb-4 text-sm font-medium text-slate-500">
        Botda «Filial direktori» lavozimini tanlab ro'yxatdan o'tganlar. Tasdiqlasangiz — shu filial direktori bo'ladi, Telegram'i ulanadi,
        panelga kirish login va paroli botga yuboriladi.
      </p>
      {decide.isError && (
        <div className="mb-3">
          <Alert>{(decide.error as Error).message}</Alert>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((r) => (
          <Card key={r.id} className="flex flex-col gap-4 p-5 ring-2 ring-amber-300/60">
            <div className="flex items-start gap-3">
              <Avatar name={r.fullName} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-extrabold">{r.fullName}</div>
                <div className="text-xs font-semibold text-slate-500">{r.phone}</div>
              </div>
              <Badge tone="amber" dot>
                Kutilmoqda
              </Badge>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div>
                <span className="text-slate-500">Filial: </span>
                <b>{r.branchName}</b>
              </div>
              <div className="mt-0.5">
                <span className="text-slate-500">Hozirgi direktor: </span>
                <b>{r.currentDirector ?? "yo'q"}</b>
                {r.currentDirector && <span className="text-xs text-amber-700"> — tasdiqlansa almashtiriladi</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="success"
                icon={Check}
                className="flex-1"
                loading={decide.isPending && decide.variables?.id === r.id && decide.variables.approve}
                onClick={() => decide.mutate({ id: r.id, approve: true })}
              >
                Tasdiqlash
              </Button>
              <Button
                variant="white"
                icon={X}
                loading={decide.isPending && decide.variables?.id === r.id && !decide.variables.approve}
                onClick={() => decide.mutate({ id: r.id, approve: false })}
              >
                Rad etish
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

export default function BranchesPage() {
  const query = useQuery({ queryKey: ['admin-branches'], queryFn: api.getAdminBranches })
  const [editing, setEditing] = useState<AdminBranch | 'new' | null>(null)
  const [directorFor, setDirectorFor] = useState<AdminBranch | null>(null)

  const list = query.data ?? []
  const withoutDirector = list.filter((b) => !b.director).length
  const notLinked = list.filter((b) => b.director && !b.director.telegramLinked).length

  return (
    <div>
      <AdminHeader
        title="Filiallar"
        subtitle={query.data ? `${list.length} ta filial · har biriga direktor tayinlang` : 'Filiallar va direktorlar'}
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>Filial qo'shish</Button>}
      />

      <DirectorRequests />

      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="Hali filial yo'q" text="Birinchi filialni qo'shing: maktab, akademiya yoki bog'cha." action={<Button icon={Plus} onClick={() => setEditing('new')}>Filial qo'shish</Button>} />
        </Card>
      ) : (
        <div className="space-y-8">
          {(withoutDirector > 0 || notLinked > 0) && (
            <Alert tone="amber">
              {withoutDirector > 0 && <div>{withoutDirector} ta filialda direktor tayinlanmagan — u yerda o'rinbosarni faqat mas'ul shaxs tasdiqlaydi.</div>}
              {notLinked > 0 && <div>{notLinked} ta direktor Telegram'ni ulamagan — ularga bot xabarlari bormaydi.</div>}
            </Alert>
          )}
          {ORG_LIST.map((o) => {
            const items = list.filter((b) => b.org === o.id)
            if (items.length === 0) return null
            return (
              <section key={o.id}>
                <h2 className="mb-4 flex items-center gap-3 text-lg font-extrabold">
                  <OrgLogo org={o.id} className="h-8 w-8 rounded-lg" />
                  {ORGS[o.id].name}
                  <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-extrabold text-slate-600">{items.length}</span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {items.map((b) => (
                    <BranchCard key={b.id} b={b} onEdit={() => setEditing(b)} onDirector={() => setDirectorFor(b)} />
                  ))}
                </div>
              </section>
            )
          })}
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Send className="h-3.5 w-3.5" /> Direktor o'z panelidagi «Telegram'ni ulash» tugmasi bilan botni ulaydi.
          </p>
        </div>
      )}

      {editing && <BranchForm branch={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {directorFor && <DirectorForm branch={directorFor} onClose={() => setDirectorFor(null)} />}
    </div>
  )
}
