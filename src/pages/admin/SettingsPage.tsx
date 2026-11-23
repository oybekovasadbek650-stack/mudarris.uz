// Sozlamalar uch darajada: Umumiy -> Tashkilot turi (maktab/akademiya/bog'cha) -> Filial.
// Pastki darajada faqat "Alohida" belgilangan qiymatlar saqlanadi, qolgani yuqoridan meros.
// Rahbariyat — hamma daraja; direktor — faqat o'z filiali.
import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, Building2, CalendarDays, Gauge, ScanFace, Send, Timer, Wallet, type LucideIcon } from 'lucide-react'
import { api } from '../../api'
import { formatMoney, WEEKDAYS_SHORT } from '../../lib/date'
import { BRANCH_SETTING_KEYS, type BranchSettingKey, type Org, type Settings, type SettingsOverride } from '../../types'
import { ORG_LIST, ORGS } from '../../lib/org'
import { OrgLogo, MudarrisLogo } from '../../components/OrgLogo'
import { Alert, Button, Card, ErrorState, IconTile, LoadingState, cx } from '../../components/ui'
import { AdminHeader } from './AdminLayout'
import { TimeField } from '../../components/Pickers'
import { useToast } from '../../lib/toast'
import { useOrgBranches, usePanelUser } from '../../lib/adminOrg'
import { BranchSelect } from '../../components/BranchSelect'
import { Select } from '../../components/Select'

type Scope = { kind: 'global' } | { kind: 'org'; org: Org } | { kind: 'branch'; id: string }

const numInput =
  'w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-right text-base font-extrabold ring-1 ring-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:text-slate-400 sm:w-44'

function Switch({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'relative h-8 w-14 rounded-full transition disabled:cursor-not-allowed',
        on
          ? disabled
            ? 'bg-violet-300' // meros qiymat: tekis rang, soyasiz (shaffof soya buzilib ko'rinardi)
            : 'bg-linear-to-r from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/30'
          : 'bg-slate-200',
      )}
    >
      <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-7' : 'left-1')} />
    </button>
  )
}

/** Bitta sozlama qatori. override berilsa — "Alohida" belgisi va meros manbai ko'rsatiladi */
function SettingRow({
  icon,
  gradient,
  title,
  hint,
  children,
  override,
}: {
  icon: LucideIcon
  gradient: string
  title: string
  hint: string
  children: ReactNode
  override?: { on: boolean; toggle: () => void; inheritedFrom: string; readOnly: boolean }
}) {
  return (
    <div className={cx('flex flex-wrap items-center gap-4 py-5 first:pt-0 last:pb-0', override && !override.on && 'opacity-80')}>
      <IconTile icon={icon} gradient={gradient} />
      <div className="min-w-48 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-extrabold">
          {title}
          {override &&
            (override.on ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-extrabold text-violet-700">alohida</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{override.inheritedFrom}dan</span>
            ))}
        </div>
        <div className="text-sm font-medium text-slate-500">{hint}</div>
        {override && !override.readOnly && (
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={override.on} onChange={override.toggle} />
            Bu yerda alohida qiymat
          </label>
        )}
      </div>
      <div className="w-full sm:w-auto">{children}</div>
    </div>
  )
}

function Suffix({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-bold text-slate-400">{children}</span>
}

function WorkDays({ value, onChange, disabled }: { value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const on = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cx(
              'h-10 w-11 rounded-xl text-sm font-extrabold transition disabled:cursor-not-allowed',
              on ? 'bg-linear-to-br from-brand to-brand-strong text-white shadow-md shadow-brand/25' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
              disabled && 'opacity-60',
            )}
          >
            {WEEKDAYS_SHORT[d - 1]}
          </button>
        )
      })}
    </div>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { me, isDirector } = usePanelUser()
  const { allBranches } = useOrgBranches()
  const tree = useQuery({ queryKey: ['settings-tree'], queryFn: api.getSettingsTree })
  const [pickedScope, setScope] = useState<Scope>({ kind: 'global' })
  // Direktor — doim o'z filiali
  const scope: Scope = isDirector && me ? { kind: 'branch', id: me.branchId } : pickedScope
  const scopeKey = scope.kind === 'global' ? 'global' : scope.kind === 'org' ? `org:${scope.org}` : `branch:${scope.id}`

  const [drafts, setDrafts] = useState<Record<string, Settings | SettingsOverride>>({})
  const toast = useToast()
  const invalidate = (data?: unknown) => {
    toast('Sozlamalar saqlandi')
    if (data) qc.setQueryData(['settings-tree'], data)
    else qc.invalidateQueries({ queryKey: ['settings-tree'] })
    qc.invalidateQueries({ queryKey: ['settings'] })
    qc.invalidateQueries({ queryKey: ['me'] })
    setDrafts((d) => {
      const n = { ...d }
      delete n[scopeKey]
      return n
    })
  }
  const saveGlobal = useMutation({ mutationFn: (s: Settings) => api.saveSettings(s), onSuccess: () => invalidate() })
  const saveOverride = useMutation({
    mutationFn: (v: SettingsOverride) =>
      scope.kind === 'org' ? api.saveSettingsOverride('org', scope.org, v) : api.saveSettingsOverride('branch', (scope as { id: string }).id, v),
    onSuccess: (data) => invalidate(data),
  })
  const save = scope.kind === 'global' ? saveGlobal : saveOverride

  if (tree.isError) return <ErrorState error={tree.error} onRetry={() => tree.refetch()} />
  if (!tree.data || (isDirector && !me)) return <LoadingState />
  const t = tree.data

  const branch = scope.kind === 'branch' ? allBranches.find((b) => b.id === scope.id) : undefined
  // Yuqori daraja (meros manbai) va uning nomi
  const parent: Settings =
    scope.kind === 'global' ? t.global : scope.kind === 'org' ? t.global : { ...t.global, ...(branch ? t.orgs[branch.org] : {}) }
  const parentName = (key: BranchSettingKey) =>
    scope.kind === 'branch' && branch && t.orgs[branch.org]?.[key] !== undefined ? ORGS[branch.org].short : 'Umumiy'
  const saved: Settings | SettingsOverride =
    scope.kind === 'global' ? t.global : scope.kind === 'org' ? (t.orgs[scope.org] ?? {}) : (t.branches[scope.id] ?? {})
  const draft = drafts[scopeKey] ?? saved
  const setDraft = (next: Settings | SettingsOverride) => {
    save.reset()
    setDrafts((d) => ({ ...d, [scopeKey]: next }))
  }
  const isGlobal = scope.kind === 'global'
  const ov = draft as SettingsOverride
  const value = <K extends keyof Settings>(k: K): Settings[K] =>
    isGlobal ? (draft as Settings)[k] : ((ov as Settings)[k] ?? parent[k])
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch })
  const overrideOf = (k: BranchSettingKey) =>
    isGlobal
      ? undefined
      : {
          on: k in ov,
          readOnly: false,
          inheritedFrom: parentName(k),
          toggle: () => {
            const n = { ...ov } as Record<string, unknown>
            if (k in n) delete n[k]
            else n[k] = parent[k]
            setDraft(n as SettingsOverride)
          },
        }
  const disabled = (k: BranchSettingKey) => !isGlobal && !(k in ov)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const overrideCount = (o?: SettingsOverride) => Object.keys(o ?? {}).length

  const scopeTitle =
    scope.kind === 'global' ? 'Umumiy (hamma filiallar)' : scope.kind === 'org' ? `${ORGS[scope.org].name} (barcha filiallari)` : branch?.name ?? 'Filial'

  return (
    <div className="max-w-6xl">
      <AdminHeader title="Sozlamalar" subtitle={isDirector ? "Filialingiz uchun o'rinbosar qidirish qoidalari" : 'Umumiy → tashkilot turi → filial'} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">

      {!isDirector && (
        <Card className="mb-5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setScope({ kind: 'global' })}
              className={cx('flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold transition', isGlobal ? 'bg-brand/10 text-brand-strong ring-2 ring-brand' : 'hover:bg-slate-100')}
            >
              <MudarrisLogo className="h-7 w-7 rounded-lg shadow-none" /> Umumiy
            </button>
            {ORG_LIST.map((o) => {
              const active = scope.kind === 'org' && scope.org === o.id
              const n = overrideCount(t.orgs[o.id])
              return (
                <button
                  key={o.id}
                  onClick={() => setScope({ kind: 'org', org: o.id })}
                  className={cx('flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold transition', active ? 'bg-brand/10 text-brand-strong ring-2 ring-brand' : 'hover:bg-slate-100')}
                >
                  <OrgLogo org={o.id} className="h-7 w-7 rounded-lg shadow-none" /> {o.short}
                  {n > 0 && <span className="rounded-full bg-violet-100 px-1.5 text-[11px] text-violet-700">{n}</span>}
                </button>
              )
            })}
            <BranchSelect
              className={cx('ml-auto min-w-64', scope.kind === 'branch' && 'ring-2 ring-brand')}
              value={scope.kind === 'branch' ? scope.id : ''}
              onChange={(id) => id && setScope({ kind: 'branch', id })}
              branches={allBranches}
              placeholder="Filialni tanlang…"
              hint={(b) => (overrideCount(t.branches[b.id]) > 0 ? `${overrideCount(t.branches[b.id])} alohida` : undefined)}
            />
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">{scopeTitle}</h2>
        {!isGlobal && overrideCount(saved as SettingsOverride) > 0 && (
          <span className="text-xs font-bold text-violet-700">{overrideCount(saved as SettingsOverride)} ta alohida qiymat</span>
        )}
      </div>
      {!isGlobal && (
        <div className="mb-4">
          <Alert tone="blue">
            {scope.kind === 'org'
              ? `Bu yerda belgilangan qiymatlar ${ORGS[scope.org].name}ning hamma filiallariga tegishli (filialda alohida belgilanmagan bo'lsa).`
              : "Faqat «alohida» belgilangan qiymatlar shu filial uchun saqlanadi, qolganlari yuqori darajadan olinadi."}
          </Alert>
        </div>
      )}

      <Card className="divide-y divide-slate-100 p-6">
        <SettingRow
          icon={CalendarDays}
          gradient="from-brand to-brand-strong"
          title="Ish kunlari"
          hint="Faqat shu kunlarga «Kela olmayman» arizasi beriladi va davomat tekshiriladi"
          override={overrideOf('workDays')}
        >
          <WorkDays value={value('workDays')} onChange={(v) => set({ workDays: v })} disabled={disabled('workDays')} />
        </SettingRow>
        <SettingRow
          icon={AlarmClock}
          gradient="from-brand to-brand-strong"
          title="Xabar berish muddati"
          hint="Dars kuni soat nechagacha xabar berish kerak. Kechroq yuborilgan ariza ham qabul qilinadi, lekin «Kech xabar berildi» belgisi bilan"
          override={overrideOf('noticeDeadline')}
        >
          <TimeField value={value('noticeDeadline')} disabled={disabled('noticeDeadline')} onChange={(v) => set({ noticeDeadline: v })} />
        </SettingRow>
        <SettingRow icon={Gauge} gradient="from-brand to-brand-strong" title="Kunlik chegara" hint="Bir ustoz bir kunda ko'pi bilan nechta o'rinbosar darsga kiradi" override={overrideOf('dailyLimit')}>
          <div className="relative">
            <input type="number" min={1} max={10} className={numInput} value={value('dailyLimit')} disabled={disabled('dailyLimit')} onChange={(e) => set({ dailyLimit: Number(e.target.value) })} />
            <Suffix>dars</Suffix>
          </div>
        </SettingRow>
        <SettingRow
          icon={Timer}
          gradient="from-brand to-brand-strong"
          title="Taklifga javob muddati"
          hint="Javob bo'lmasa taklif yopiladi. Dars yaqin bo'lsa muddat qisqaradi: dars boshlanishidan 10 daqiqa oldin tugaydi"
          override={overrideOf('offerTimeoutMinutes')}
        >
          <div className="relative">
            <input type="number" min={5} max={1440} step={5} className={numInput} value={value('offerTimeoutMinutes')} disabled={disabled('offerTimeoutMinutes')} onChange={(e) => set({ offerTimeoutMinutes: Number(e.target.value) })} />
            <Suffix>daqiqa</Suffix>
          </div>
        </SettingRow>
        <SettingRow
          icon={Send}
          gradient="from-brand to-brand-strong"
          title="Taklif kimga yuboriladi"
          hint="«Hammaga birdaniga» — eng tez: barcha mos ustozlarga bir vaqtda, birinchi rozi bo'lganlar darhol direktorga tasdiqlash uchun boradi"
          override={overrideOf('offerBatchSize')}
        >
          <Select
            className="sm:w-56"
            value={String(value('offerBatchSize'))}
            disabled={disabled('offerBatchSize')}
            onChange={(v) => set({ offerBatchSize: Number(v) })}
            ariaLabel="Taklif kimga yuboriladi"
            searchable={false}
            options={[
              { value: '0', label: 'Hammaga birdaniga', hint: 'tavsiya' },
              { value: '1', label: 'Navbat bilan: 1 tadan' },
              { value: '2', label: 'Navbat bilan: 2 tadan' },
              { value: '3', label: 'Navbat bilan: 3 tadan' },
              { value: '5', label: 'Navbat bilan: 5 tadan' },
            ]}
          />
        </SettingRow>
        <SettingRow
          icon={ScanFace}
          gradient="from-brand to-brand-strong"
          title="Davomat: «kelmadi» signali"
          hint="Birinchi darsdan oldin davomatda kirish bo'lmasa — bot ustozdan «Kelyapsizmi?» deb so'raydi; javob bo'lmasa direktor va mas'ulga xabar beradi. Avtomatik ariza ochilmaydi."
          override={overrideOf('attendanceCheck')}
        >
          <Switch on={value('attendanceCheck')} disabled={disabled('attendanceCheck')} onClick={() => set({ attendanceCheck: !value('attendanceCheck') })} label="Davomat signali" />
        </SettingRow>
        {value('attendanceCheck') && (
          <>
            <SettingRow icon={Timer} gradient="from-brand to-brand-strong" title="Ustozdan qachon so'rash" hint="Birinchi darsi boshlanishidan necha daqiqa oldin" override={overrideOf('attendanceAskMinutes')}>
              <div className="relative">
                <input type="number" min={5} max={180} step={5} className={numInput} value={value('attendanceAskMinutes')} disabled={disabled('attendanceAskMinutes')} onChange={(e) => set({ attendanceAskMinutes: Number(e.target.value) })} />
                <Suffix>daqiqa</Suffix>
              </div>
            </SettingRow>
            <SettingRow
              icon={Timer}
              gradient="from-brand to-brand-strong"
              title="Direktorga xabar"
              hint="Ustoz javob bermasa, necha daqiqadan keyin direktor va mas'ulga xabar beriladi"
              override={overrideOf('attendanceEscalateMinutes')}
            >
              <div className="relative">
                <input type="number" min={5} max={120} step={5} className={numInput} value={value('attendanceEscalateMinutes')} disabled={disabled('attendanceEscalateMinutes')} onChange={(e) => set({ attendanceEscalateMinutes: Number(e.target.value) })} />
                <Suffix>daqiqa</Suffix>
              </div>
            </SettingRow>
          </>
        )}
        <SettingRow
          icon={Wallet}
          gradient="from-brand to-brand-strong"
          title="Haq miqdori"
          hint={`Bitta o'rinbosar dars uchun: ${formatMoney(value('paymentPerLesson') || 0)}`}
          override={overrideOf('paymentPerLesson')}
        >
          <div className="relative">
            <input type="number" min={0} step={1000} className={numInput} value={value('paymentPerLesson')} disabled={disabled('paymentPerLesson')} onChange={(e) => set({ paymentPerLesson: Number(e.target.value) })} />
            <Suffix>so'm</Suffix>
          </div>
        </SettingRow>
        {isGlobal && (
          <SettingRow icon={Building2} gradient="from-brand to-brand-strong" title="Boshqa filialga o'tish" hint="O'z filialida nomzod topilmasa, boshqa filial ustozlariga ham taklif yuboriladi (faqat umumiy sozlama)">
            <Switch on={(draft as Settings).allowCrossBranch} onClick={() => set({ allowCrossBranch: !(draft as Settings).allowCrossBranch })} label="Boshqa filialga o'tish" />
          </SettingRow>
        )}
      </Card>

      <div className={cx('mt-5 space-y-4', dirty && 'sticky bottom-4 z-20 rounded-3xl bg-white/90 p-4 shadow-2xl ring-1 ring-black/5 backdrop-blur')}>
        {save.isError && <Alert>{(save.error as Error).message}</Alert>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && <span className="mr-auto text-sm font-bold text-amber-700">Saqlanmagan o'zgarishlar bor</span>}
          {!isGlobal && overrideCount(saved as SettingsOverride) > 0 && (
            <Button variant="white" disabled={save.isPending} onClick={() => saveOverride.mutate({})}>
              Hammasini merosga qaytarish
            </Button>
          )}
          <Button
            variant="white"
            disabled={!dirty}
            onClick={() =>
              setDrafts((d) => {
                const n = { ...d }
                delete n[scopeKey]
                return n
              })
            }
          >
            Bekor qilish
          </Button>
          <Button
            disabled={!dirty}
            loading={save.isPending}
            onClick={() => (isGlobal ? saveGlobal.mutate(draft as Settings) : saveOverride.mutate(pickOverride(draft as SettingsOverride)))}
          >
            Saqlash
          </Button>
        </div>
      </div>
      </div>

      <SettingsAside
        isDirector={isDirector}
        orgs={t.orgs}
        branches={t.branches}
        branchName={(id) => allBranches.find((b) => b.id === id)?.name ?? id}
        onPick={(s) => setScope(s)}
      />
      </div>
    </div>
  )
}

/** O'ng panel: sozlamalar qanday ishlaydi + qayerda alohida qiymatlar bor */
function SettingsAside({
  isDirector,
  orgs,
  branches,
  branchName,
  onPick,
}: {
  isDirector: boolean
  orgs: Partial<Record<Org, SettingsOverride>>
  branches: Record<string, SettingsOverride>
  branchName: (id: string) => string
  onPick: (s: Scope) => void
}) {
  const levels = [
    { title: 'Umumiy', text: 'Hamma filial uchun asos' },
    { title: 'Tashkilot turi', text: "Maktab, akademiya yoki bog'cha — ularning hamma filiallari" },
    { title: 'Filial', text: "Faqat shu filial. Eng ustun daraja" },
  ]
  const custom = [
    ...ORG_LIST.filter((o) => Object.keys(orgs[o.id] ?? {}).length).map((o) => ({ key: o.id, label: ORGS[o.id].name, n: Object.keys(orgs[o.id]!).length, scope: { kind: 'org', org: o.id } as Scope })),
    ...Object.entries(branches)
      .filter(([, v]) => Object.keys(v).length)
      .map(([id, v]) => ({ key: id, label: branchName(id), n: Object.keys(v).length, scope: { kind: 'branch', id } as Scope })),
  ]
  return (
    <aside className="space-y-5 xl:sticky xl:top-6">
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-extrabold tracking-wide text-slate-500 uppercase">Qanday ishlaydi</h3>
        <ol className="relative space-y-4 border-l-2 border-dashed border-brand/25 pl-5">
          {levels.map((l, i) => (
            <li key={l.title} className="relative">
              <span className="absolute top-0 -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-brand to-brand-strong text-[10px] font-extrabold text-white shadow">
                {i + 1}
              </span>
              <div className="text-sm font-extrabold">{l.title}</div>
              <div className="text-xs font-medium text-slate-500">{l.text}</div>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs font-medium text-slate-500">
          Pastki darajada faqat <b className="text-violet-700">alohida</b> belgilangan qiymat saqlanadi. Qolgani yuqoridan avtomatik olinadi — umumiyni
          o'zgartirsangiz, alohida qiymati yo'q filiallarga darhol ta'sir qiladi.
        </p>
      </Card>
      {!isDirector && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-extrabold tracking-wide text-slate-500 uppercase">Alohida sozlanganlar</h3>
          {custom.length === 0 ? (
            <div className="text-sm font-medium text-slate-400">Hozircha hamma filial umumiy sozlamada ishlaydi.</div>
          ) : (
            <div className="space-y-1">
              {custom.map((c) => (
                <button
                  key={c.key}
                  onClick={() => onPick(c.scope)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold transition hover:bg-slate-50"
                >
                  <span className="truncate">{c.label}</span>
                  <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-extrabold text-violet-700">{c.n} ta</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
    </aside>
  )
}

/** Faqat filialda alohida bo'la oladigan maydonlar */
function pickOverride(v: SettingsOverride): SettingsOverride {
  const out: Record<string, unknown> = {}
  for (const k of BRANCH_SETTING_KEYS) if (k in v) out[k] = (v as Record<string, unknown>)[k]
  return out as SettingsOverride
}
