// O'qituvchilar: ro'yxat, qo'shish/tahrirlash formasi, Telegram ulanganmi belgisi
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock3, Pencil, Phone, Search, Send, ShieldCheck, UserRoundPen, UsersRound, X } from 'lucide-react'
import { api } from '../../api'
import type { TeacherInput } from '../../api/contract'
import { formatDate } from '../../lib/date'
import type { Branch, Teacher } from '../../types'
import { Alert, Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, IconTile, LoadingState, SubjectChip, cx, inputClass } from '../../components/ui'
import { AdminHeader, selectClass } from './AdminLayout'
import { useOrgBranches } from '../../lib/adminOrg'
import { ORGS } from '../../lib/org'

function TeacherForm({ initial, branches, onClose }: { initial: Teacher; branches: Branch[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    fullName: initial.fullName,
    phone: initial.phone,
    subjects: initial.subjects.join(', '),
    branchId: initial.branchId,
    isCoordinator: initial.isCoordinator,
  })
  const save = useMutation({
    mutationFn: () => {
      const input: TeacherInput = {
        id: initial.id,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        subjects: form.subjects.split(',').map((s) => s.trim()).filter(Boolean),
        branchId: form.branchId,
        isCoordinator: form.isCoordinator,
      }
      return api.saveTeacher(input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg animate-fade-up overflow-hidden rounded-[28px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 bg-linear-to-r from-brand via-brand to-brand-strong px-6 py-5 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
            <UserRoundPen className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">O'qituvchini tahrirlash</h2>
            <div className="text-xs font-semibold text-white/70">Login: {initial.login}</div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/15" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefon" hint="Telegram'ga ulanish shu raqam bilan">
              <input className={inputClass} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </Field>
            <Field label="Filial">
              <select className={inputClass} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Fanlar" hint="Vergul bilan ajrating: Matematika, Fizika">
            <input className={inputClass} value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} required />
          </Field>
          <label className={cx('flex cursor-pointer items-center gap-3 rounded-2xl p-4 ring-2 transition', form.isCoordinator ? 'bg-brand/8 ring-brand' : 'bg-slate-50 ring-transparent')}>
            <input type="checkbox" className="h-5 w-5 accent-brand" checked={form.isCoordinator} onChange={(e) => setForm({ ...form, isCoordinator: e.target.checked })} />
            <span>
              <span className="block text-sm font-extrabold">Mas'ul shaxs</span>
              <span className="block text-xs font-medium text-slate-500">O'rinbosar nomzodlarini tanlash huquqi</span>
            </span>
          </label>
          {save.isError && <Alert>{(save.error as Error).message}</Alert>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Bekor qilish</Button>
            <Button type="submit" loading={save.isPending}>Saqlash</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PendingCard({ t, branchName }: { t: Teacher; branchName: string }) {
  const qc = useQueryClient()
  const decide = useMutation({
    mutationFn: (approve: boolean) => (approve ? api.approveTeacher(t.id) : api.rejectTeacher(t.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }),
  })
  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <Avatar name={t.fullName} size="lg" />
      <div className="min-w-56 flex-1">
        <div className="text-base font-extrabold">{t.fullName}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {t.phone}</span>
          <span>{branchName}</span>
          <span>login: <b className="text-slate-700">{t.login}</b></span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDate(t.registeredAt)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">{t.subjects.map((s) => <SubjectChip key={s} subject={s} />)}</div>
      </div>
      {decide.isError && <div className="w-full"><Alert>{(decide.error as Error).message}</Alert></div>}
      <div className="flex gap-2">
        <Button variant="white" icon={X} disabled={decide.isPending} loading={decide.isPending && decide.variables === false} onClick={() => decide.mutate(false)}>
          Rad etish
        </Button>
        <Button variant="success" icon={Check} disabled={decide.isPending} loading={decide.isPending && decide.variables === true} onClick={() => decide.mutate(true)}>
          Tasdiqlash
        </Button>
      </div>
    </Card>
  )
}

export default function TeachersPage() {
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: api.getTeachers })
  const { org, branches, allBranches, inOrg, branchName } = useOrgBranches()
  const staff = org === 'all' ? "Xodimlar" : ORGS[org].staffPlural
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState('')

  const q = search.toLowerCase()
  const pendingList = teachers.data?.filter((t) => t.status === 'pending' && inOrg(t.branchId)) ?? []
  const active = teachers.data?.filter((t) => t.status === 'active' && inOrg(t.branchId)) ?? []
  const list =
    active.filter(
      (t) => (!branchId || t.branchId === branchId) && (t.fullName.toLowerCase().includes(q) || t.subjects.join(' ').toLowerCase().includes(q)),
    )
  const total = active.length
  const linked = active.filter((t) => t.telegramLinked).length
  const coordinators = active.filter((t) => t.isCoordinator).length

  return (
    <div>
      <AdminHeader
        title={staff}
        subtitle="O'qituvchilar o'zlari ro'yxatdan o'tadi — siz faqat tasdiqlaysiz"
      />

      {pendingList.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
            Tasdiq kutayotganlar
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 text-xs font-extrabold text-white">{pendingList.length}</span>
          </h2>
          <div className="space-y-3">
            {pendingList.map((t) => <PendingCard key={t.id} t={t} branchName={branchName(t.branchId)} />)}
          </div>
        </section>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <IconTile icon={UsersRound} gradient="from-brand to-brand-strong" />
          <div>
            <div className="text-3xl font-extrabold">{total}</div>
            <div className="text-sm font-bold text-slate-500">jami o'qituvchi</div>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <IconTile icon={Send} gradient="from-sky-400 to-cyan-500" />
          <div>
            <div className="text-3xl font-extrabold">{linked}<span className="text-lg text-slate-400">/{total}</span></div>
            <div className="text-sm font-bold text-slate-500">Telegram ulangan</div>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <IconTile icon={ShieldCheck} gradient="from-violet-500 to-fuchsia-500" />
          <div>
            <div className="text-3xl font-extrabold">{coordinators}</div>
            <div className="text-sm font-bold text-slate-500">mas'ul shaxs</div>
          </div>
        </Card>
      </div>

      {total - linked > 0 && (
        <div className="mb-5">
          <Alert tone="amber">
            {total - linked} ta o'qituvchi Telegram botga ulanmagan — ular taklif va xabarlarni olmaydi. Ular Telegram bot ichida bir marta login-parol bilan kirsa, avtomatik ulanadi.
          </Alert>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={cx(selectClass, 'w-full pl-11')} placeholder="Ism yoki fan bo'yicha qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={selectClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">Barcha filiallar</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {teachers.isPending ? (
        <LoadingState />
      ) : teachers.isError ? (
        <ErrorState error={teachers.error} onRetry={() => teachers.refetch()} />
      ) : list.length === 0 ? (
        <Card>
          {total === 0 ? (
            <EmptyState icon={UsersRound} title="Hali tasdiqlangan o'qituvchi yo'q" text="O'qituvchilar Telegram bot orqali ro'yxatdan o'tadi. Arizalari shu sahifada chiqadi." />
          ) : (
            <EmptyState icon={Search} title="Hech kim topilmadi" text="Qidiruv so'zini yoki filialni o'zgartirib ko'ring." />
          )}
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-3.5">O'qituvchi</th>
                <th className="px-4 py-3.5">Fanlar</th>
                <th className="px-4 py-3.5">Filial</th>
                <th className="px-4 py-3.5">Telegram</th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="group border-t border-slate-100 transition hover:bg-brand/5">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={t.fullName} />
                      <div>
                        <div className="flex items-center gap-2 font-extrabold">
                          {t.fullName}
                          {t.isCoordinator && <Badge tone="violet">Mas'ul</Badge>}
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-slate-400">
                          <Phone className="h-3 w-3" /> {t.phone}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">{t.subjects.map((s) => <SubjectChip key={s} subject={s} />)}</div>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-600">{branchName(t.branchId)}</td>
                  <td className="px-4 py-3.5">
                    {t.telegramLinked ? <Badge tone="blue" dot>Ulangan</Badge> : <Badge tone="red" dot>Ulanmagan</Badge>}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(t)}>Tahrirlash</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <TeacherForm
          key={editing.id}
          initial={editing}
          branches={allBranches}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
