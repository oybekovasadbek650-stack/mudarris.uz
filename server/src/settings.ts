// Sozlamalar uch darajada: umumiy -> tashkilot turi (maktab/akademiya/bog'cha) -> filial.
// Pastki daraja faqat o'zgartirilgan qiymatlarni saqlaydi, qolgani yuqoridan meros oladi.
// "Boshqa filialga o'tish" (allowCrossBranch) — faqat umumiy.
import { db } from './db.ts'
import { fail, getSettings, orgOf, putSettings } from './repo.ts'
import { isTime } from './time.ts'
import { BRANCH_SETTING_KEYS, type BranchSettingKey, type Org, type Settings, type SettingsOverride, type SettingsTree } from '../../src/types.ts'

const ORGS: Org[] = ['school', 'academy', 'kindergarten']

/** Bitta maydonni tekshiradi va tozalangan qiymatni qaytaradi (xato bo'lsa — 400) */
function cleanValue(key: BranchSettingKey, v: unknown): unknown {
  const int = (min: number, max: number, msg: string) => {
    const n = Number(v)
    if (!Number.isInteger(n) || n < min || n > max) fail(400, msg)
    return n
  }
  switch (key) {
    case 'noticeDeadline':
      if (!isTime(v)) fail(400, "Xabar berish muddati HH:MM ko'rinishida bo'lsin")
      return v
    case 'dailyLimit':
      return int(1, 10, "Kunlik chegara 1 dan 10 gacha bo'lishi kerak")
    case 'offerTimeoutMinutes':
      return int(5, 1440, "Taklifga javob muddati 5 daqiqadan 1440 daqiqagacha (24 soat) bo'lishi kerak")
    case 'offerBatchSize':
      return int(0, 10, "Taklif soni 0 (hammaga) dan 10 gacha bo'lishi kerak")
    case 'paymentPerLesson': {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0 || n > 100_000_000) fail(400, "Haq miqdori noto'g'ri")
      return Math.round(n)
    }
    case 'workDays': {
      if (!Array.isArray(v)) return fail(400, "Ish kunlari ro'yxat bo'lishi kerak")
      const days = [...new Set(v.map(Number))].sort()
      if (days.length === 0) fail(400, 'Kamida bitta ish kunini tanlang')
      if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) fail(400, "Ish kunlari 1 (Dushanba) dan 7 (Yakshanba) gacha")
      return days
    }
    case 'attendanceCheck':
      return Boolean(v)
    case 'attendanceAskMinutes':
      return int(5, 180, "Davomat: so'rash vaqti darsdan 5–180 daqiqa oldin bo'lishi kerak")
    case 'attendanceEscalateMinutes':
      return int(5, 120, "Davomat: direktorga xabar berish 5–120 daqiqa ichida bo'lishi kerak")
  }
}

/** Umumiy sozlamalar: hamma maydon majburiy */
export function validateGlobal(input: Record<string, unknown>): Settings {
  const out = { ...getSettings() } as Record<string, unknown>
  for (const k of BRANCH_SETTING_KEYS) out[k] = cleanValue(k, input[k] ?? out[k])
  out.allowCrossBranch = Boolean(input.allowCrossBranch)
  return out as unknown as Settings
}

/** Qayta belgilash: faqat berilgan (null bo'lmagan) maydonlar; noma'lum maydonlar e'tiborsiz */
export function validateOverride(input: Record<string, unknown>): SettingsOverride {
  const out: Record<string, unknown> = {}
  for (const k of BRANCH_SETTING_KEYS) {
    if (input[k] !== undefined && input[k] !== null) out[k] = cleanValue(k, input[k])
  }
  return out as SettingsOverride
}

function readOverride(scope: string): SettingsOverride {
  const r = db().prepare('SELECT value FROM settings_overrides WHERE scope = ?').get(scope) as { value: string } | undefined
  if (!r) return {}
  try {
    return validateOverride(JSON.parse(r.value)) // eski/buzilgan qiymatlar tushib qoladi
  } catch {
    return {}
  }
}

export function putOverride(scope: string, override: SettingsOverride) {
  if (Object.keys(override).length === 0) {
    db().prepare('DELETE FROM settings_overrides WHERE scope = ?').run(scope)
  } else {
    db()
      .prepare('INSERT INTO settings_overrides (scope, value) VALUES (?, ?) ON CONFLICT(scope) DO UPDATE SET value = excluded.value')
      .run(scope, JSON.stringify(override))
  }
}

export const orgScope = (org: Org) => `org:${org}`
export const branchScope = (branchId: string) => `branch:${branchId}`

/** Filial uchun amaldagi sozlamalar: umumiy + tashkilot turi + filial */
export function effectiveSettings(branchId?: string | null): Settings {
  const global = getSettings()
  if (!branchId) return global
  return { ...global, ...readOverride(orgScope(orgOf(branchId))), ...readOverride(branchScope(branchId)) }
}

/** Hamma darajalar (panel uchun). onlyBranchId — direktor: faqat o'z filiali va uning tashkiloti */
export function settingsTree(onlyBranchId?: string): SettingsTree {
  const tree: SettingsTree = { global: getSettings(), orgs: {}, branches: {} }
  const orgs = onlyBranchId ? [orgOf(onlyBranchId)] : ORGS
  for (const o of orgs) {
    const v = readOverride(orgScope(o))
    if (Object.keys(v).length) tree.orgs[o] = v
  }
  const rows = db().prepare("SELECT scope FROM settings_overrides WHERE scope LIKE 'branch:%'").all() as { scope: string }[]
  for (const { scope } of rows) {
    const id = scope.slice('branch:'.length)
    if (onlyBranchId && id !== onlyBranchId) continue
    if (!db().prepare('SELECT 1 FROM branches WHERE id = ?').get(id)) continue
    tree.branches[id] = readOverride(scope)
  }
  return tree
}

export const saveGlobal = (s: Settings) => putSettings(s)

/** Biror filialda (yoki umumiy) shu yoqilganmi — masalan davomat signali */
export function anyBranchHas(pred: (s: Settings) => boolean, branchId?: string): boolean {
  if (branchId) return pred(effectiveSettings(branchId))
  if (pred(getSettings())) return true
  const ids = (db().prepare('SELECT id FROM branches').all() as { id: string }[]).map((b) => b.id)
  return ids.some((id) => pred(effectiveSettings(id)))
}
