// Davomat tizimidan filiallar va xodimlarni olish (bir tomonlama: davomat -> o'rinbosar, davomatga hech narsa yozilmaydi).
// Rahbariyat: filiallarni sinxronlaydi + xodimlarni oladi. Direktor: faqat o'z filiali xodimlarini oladi.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, Download, Link2, PlugZap, RefreshCw, Search, UserPlus, UsersRound, X } from 'lucide-react'
import { api } from '../../api'
import type { DavomatEmployeeView, DavomatImportResult } from '../../types'
import { usePanelUser } from '../../lib/adminOrg'
import { Alert, Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, cx } from '../../components/ui'
import { AdminHeader, selectClass } from './AdminLayout'
import { Select } from '../../components/Select'

const STATUS: Record<DavomatEmployeeView['status'], { text: string; tone: 'green' | 'blue' | 'gray' | 'amber' }> = {
  linked: { text: "Bog'langan", tone: 'green' },
  match: { text: 'Tizimda bor — bog\'lanadi', tone: 'blue' },
  new: { text: 'Yangi', tone: 'gray' },
  no_branch: { text: 'Filial sinxronlanmagan', tone: 'amber' },
}
const selectable = (v: DavomatEmployeeView) => v.status === 'new' || v.status === 'match'

function downloadCsv(rows: DavomatImportResult['created']) {
  const head = ['F.I.Sh.', 'Filial', 'Login', 'Parol']
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const csv = [head, ...rows.map((r) => [r.fullName, r.branchName, r.login, r.password])].map((r) => r.map(esc).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `login-parollar-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function ResultModal({ result, onClose }: { result: DavomatImportResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = result.created.map((r) => `${r.fullName} (${r.branchName}) — login: ${r.login}, parol: ${r.password}`).join('\n')
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-2xl animate-fade-up overflow-auto rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center gap-3 bg-linear-to-r from-emerald-500 to-teal-500 px-6 py-5 text-white">
          <CheckCircle2 className="h-6 w-6" />
          <h2 className="flex-1 text-lg font-extrabold">Import natijasi</h2>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/15" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Yangi hisob', result.created.length, 'text-emerald-600'],
              ["Bog'landi", result.linked.length, 'text-brand-strong'],
              ["O'tkazildi", result.skipped.length, 'text-slate-500'],
            ].map(([label, n, cls]) => (
              <div key={label as string} className="rounded-2xl bg-slate-50 py-3">
                <div className={cx('text-2xl font-extrabold', cls as string)}>{n as number}</div>
                <div className="text-xs font-bold text-slate-500">{label as string}</div>
              </div>
            ))}
          </div>

          {result.created.length > 0 && (
            <>
              <Alert tone="amber">
                <b>Parollar faqat hozir ko'rinadi.</b> CSV yuklab oling yoki nusxa oling va har bir ustozga o'z login-parolini bering. Kirgandan keyin ustoz Telegram'ni ulaydi.
              </Alert>
              <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Ustoz</th>
                      <th className="px-4 py-2.5">Login</th>
                      <th className="px-4 py-2.5">Parol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.created.map((r) => (
                      <tr key={r.login} className="border-t border-slate-100">
                        <td className="px-4 py-2.5">
                          <div className="font-bold">{r.fullName}</div>
                          <div className="text-xs font-semibold text-slate-400">{r.branchName}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold">{r.login}</td>
                        <td className="px-4 py-2.5 font-mono font-bold">{r.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={Download} onClick={() => downloadCsv(result.created)}>CSV yuklab olish</Button>
                <Button
                  variant="white"
                  icon={copied ? CheckCircle2 : Copy}
                  onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {})}
                >
                  {copied ? 'Nusxa olindi' : 'Nusxa olish'}
                </Button>
              </div>
            </>
          )}
          {result.linked.length > 0 && (
            <div className="text-sm">
              <div className="mb-1 font-extrabold">Mavjud o'qituvchilarga bog'landi:</div>
              <div className="font-medium text-slate-600">{result.linked.join(', ')}</div>
            </div>
          )}
          {result.skipped.length > 0 && (
            <div className="text-sm">
              <div className="mb-1 font-extrabold">O'tkazib yuborildi:</div>
              <ul className="list-disc pl-5 font-medium text-slate-600">
                {result.skipped.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}
          <Alert tone="blue">
            Yangi ustozlarning fanlari bo'sh. «Dars jadvali» Excel'dan yuklanganda fanlar ularning darslaridan avtomatik yoziladi, yoki «O'qituvchilar» sahifasida qo'lda kiriting.
          </Alert>
          <div className="flex justify-end">
            <Button variant="white" onClick={onClose}>Yopish</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DavomatPage() {
  const qc = useQueryClient()
  const { isDirector } = usePanelUser()
  const status = useQuery({ queryKey: ['davomat-status'], queryFn: api.getDavomatStatus })
  const enabled = status.data?.enabled === true
  const employees = useQuery({ queryKey: ['davomat-employees'], queryFn: api.getDavomatEmployees, enabled, retry: false })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [dep, setDep] = useState('')
  const [result, setResult] = useState<DavomatImportResult | null>(null)

  const sync = useMutation({
    mutationFn: api.syncDavomatBranches,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
      qc.invalidateQueries({ queryKey: ['davomat-employees'] })
    },
  })
  const doImport = useMutation({
    mutationFn: () => api.importDavomatEmployees([...picked]),
    onSuccess: (r) => {
      setResult(r)
      setPicked(new Set())
      qc.invalidateQueries({ queryKey: ['davomat-employees'] })
      qc.invalidateQueries({ queryKey: ['teachers'] })
    },
  })

  const list = useMemo(() => employees.data ?? [], [employees.data])
  const departments = useMemo(() => [...new Set(list.map((v) => v.departmentName))].sort(), [list])
  const visible = list.filter(
    (v) => (!dep || v.departmentName === dep) && (!search || v.fullName.toLowerCase().includes(search.toLowerCase()) || v.code.includes(search)),
  )
  const visibleSelectable = visible.filter(selectable)
  const allPicked = visibleSelectable.length > 0 && visibleSelectable.every((v) => picked.has(v.code))
  const toggle = (code: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(code)) n.delete(code)
      else n.add(code)
      return n
    })
  const toggleAll = () =>
    setPicked((s) => {
      const n = new Set(s)
      visibleSelectable.forEach((v) => (allPicked ? n.delete(v.code) : n.add(v.code)))
      return n
    })
  const count = (st: DavomatEmployeeView['status']) => list.filter((v) => v.status === st).length

  return (
    <div>
      <AdminHeader
        title="Davomat tizimi"
        subtitle="Filiallar va xodimlarni davomatdan olish (faqat o'qiladi, davomatga hech narsa yozilmaydi)"
        actions={
          !isDirector && enabled ? (
            <Button variant="white" icon={RefreshCw} loading={sync.isPending} onClick={() => sync.mutate()}>
              Filiallarni sinxronlash
            </Button>
          ) : undefined
        }
      />

      {status.isPending ? (
        <LoadingState />
      ) : !enabled ? (
        <Card>
          <EmptyState
            icon={PlugZap}
            gradient="from-slate-400 to-slate-500"
            title="Davomat tizimi ulanmagan"
            text="Server sozlamasiga (server/.env) DAVOMAT_URL, DAVOMAT_LOGIN va DAVOMAT_PASSWORD yozilishi kerak. Davomat jamoasidan faqat o'qish huquqiga ega alohida hisob so'rang."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ulangan: {status.data?.url}
          </div>

          {sync.isError && <Alert>{(sync.error as Error).message}</Alert>}
          {sync.isSuccess && (
            <Alert tone="green">
              Davomatda {sync.data.total} ta filial. Qo'shildi: {sync.data.created.length}
              {sync.data.created.length > 0 && ` (${sync.data.created.join(', ')})`}. Yangilandi: {sync.data.updated.length}.
              {sync.data.notInDavomat.length > 0 && (
                <div className="mt-1">Davomatda yo'q (bizda qoldi, o'chirilmadi): {sync.data.notInDavomat.join(', ')}</div>
              )}
            </Alert>
          )}

          <Alert tone="blue">
            Davomatda <b>barcha xodimlar</b> bor (o'qituvchi bo'lmaganlar ham). Faqat <b>dars beradiganlarni</b> belgilang. Tizimda shu ismli
            o'qituvchi bo'lsa — yangi hisob ochilmaydi, faqat bog'lanadi.
          </Alert>

          {employees.isPending ? (
            <LoadingState />
          ) : employees.isError ? (
            <ErrorState error={employees.error} onRetry={() => employees.refetch()} />
          ) : list.length === 0 ? (
            <Card>
              <EmptyState icon={UsersRound} title="Davomatda xodim topilmadi" text={isDirector ? "Filialingiz davomatda xodimlar bilan to'ldirilmagan." : "Avval «Filiallarni sinxronlash» ni bosing."} />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {(['new', 'match', 'linked', 'no_branch'] as const).map((st) => (
                  <Card key={st} className="p-4">
                    <div className="text-2xl font-extrabold">{count(st)}</div>
                    <div className="text-xs font-bold text-slate-500">{STATUS[st].text}</div>
                  </Card>
                ))}
              </div>
              {count('no_branch') > 0 && !isDirector && (
                <Alert tone="amber">{count('no_branch')} ta xodimning filiali hali sinxronlanmagan — yuqoridagi «Filiallarni sinxronlash» ni bosing.</Alert>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-60 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={cx(selectClass, 'w-full pl-11')} placeholder="Ism yoki kod bo'yicha qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {departments.length > 1 && (
                  <Select
                    value={dep}
                    onChange={setDep}
                    ariaLabel="Filial"
                    className="min-w-60"
                    options={[
                      { value: '', label: 'Barcha filiallar' },
                      ...departments.map((d) => ({ value: d, label: d, hint: `${list.filter((v) => v.departmentName === d).length} xodim` })),
                    ]}
                  />
                )}
                <Button icon={UserPlus} disabled={picked.size === 0} loading={doImport.isPending} onClick={() => doImport.mutate()}>
                  O'qituvchi sifatida olish ({picked.size})
                </Button>
              </div>
              {doImport.isError && <Alert>{(doImport.error as Error).message}</Alert>}

              <Card className="overflow-x-auto p-0">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="w-12 px-5 py-3.5">
                        <input type="checkbox" className="h-4 w-4 accent-brand" checked={allPicked} onChange={toggleAll} disabled={visibleSelectable.length === 0} aria-label="Hammasini tanlash" />
                      </th>
                      <th className="px-3 py-3.5">Xodim (davomat)</th>
                      <th className="px-4 py-3.5">Filial</th>
                      <th className="px-4 py-3.5">Holat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((v) => (
                      <tr
                        key={v.code}
                        onClick={() => selectable(v) && toggle(v.code)}
                        className={cx('border-t border-slate-100 transition', selectable(v) ? 'cursor-pointer hover:bg-brand/5' : 'opacity-70', picked.has(v.code) && 'bg-brand/8')}
                      >
                        <td className="px-5 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand"
                            checked={picked.has(v.code)}
                            disabled={!selectable(v)}
                            onChange={() => toggle(v.code)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={v.fullName}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={v.fullName} size="sm" />
                            <div>
                              <div className="font-bold">{v.fullName}</div>
                              <div className="text-xs font-semibold text-slate-400">kod: {v.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{v.departmentName}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS[v.status].tone} dot>{STATUS[v.status].text}</Badge>
                          {v.teacherName && v.status !== 'new' && (
                            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-400">
                              <Link2 className="h-3 w-3" /> {v.teacherName}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      )}

      {result && <ResultModal result={result} onClose={() => setResult(null)} />}
    </div>
  )
}
