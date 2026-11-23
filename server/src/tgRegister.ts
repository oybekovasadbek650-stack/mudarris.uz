// Telegram bot ichida ro'yxatdan o'tish (Mini App /join sahifasi).
//
// Oqim: ustoz botda "Raqamni ulashish" bosadi -> bot raqamni tg_contacts ga yozadi (Telegram tasdiqlagan raqam)
// -> Mini App'da ism, muassasa, filial, fan/lavozim tanlanadi -> /auth/tg-register.
// Login avtomatik: ism + telefonning oxirgi 4 raqami (aziza4567). Parol tasdiqlanganda yaratiladi va botga yuboriladi;
// Telegram ichida esa parol umuman kerak emas (initData bilan kiradi).
// Davomatdan oldin import qilingan xodim telefon raqami bo'yicha o'z yozuviga bog'lanadi (dublikat bo'lmaydi).
import { randomBytes, randomInt } from 'node:crypto'
import { db, newId } from './db.ts'
import { config } from './config.ts'
import { hashPassword, issueToken, verifyInitData, type TelegramUser } from './auth.ts'
import { fail, getTeacher, teacherRow, type TeacherRow } from './repo.ts'
import { notify } from './notify.ts'
import { localNow } from './time.ts'
import type { Org } from '../../src/types.ts'

/** Bog'chada "fan" o'rniga lavozim so'raladi */
export const KINDERGARTEN_POSITIONS = ['Tarbiyachi', 'Yordamchi tarbiyachi', 'Musiqa rahbari', 'Logoped', 'Psixolog', 'Jismoniy tarbiya', 'Ingliz tili']

/**
 * Standart fanlar ro'yxati — ustozlar o'zi yozmaydi, faqat shundan tanlaydi (bir xil nomlar = nomzod topish to'g'ri ishlaydi).
 * Hozircha maktab fanlari; akademiya ham shundan foydalanadi. Filial jadvalidagi fanlar ham qo'shiladi.
 */
export const SCHOOL_SUBJECTS = [
  "Boshlang'ich sinf",
  'Ona tili',
  'Adabiyot',
  'Matematika',
  'Algebra',
  'Geometriya',
  'Fizika',
  'Kimyo',
  'Biologiya',
  'Geografiya',
  'Tarix',
  'Huquq',
  'Iqtisodiyot',
  'Ingliz tili',
  'Rus tili',
  'Nemis tili',
  'Arab tili',
  'Informatika',
  'Texnologiya',
  'Chizmachilik',
  'Tasviriy san\'at',
  'Musiqa',
  'Jismoniy tarbiya',
  'Tarbiya',
  "Chaqiriqqacha harbiy ta'lim",
]

const digits = (s: string) => s.replace(/\D/g, '')
/** Taqqoslash uchun: oxirgi 9 raqam (operator kodi + raqam) */
export const phoneKey = (s: string) => digits(s).slice(-9)

/** "+998901234567" -> "+998 90 123 45 67" */
export function formatPhone(raw: string): string {
  let d = digits(raw)
  if (d.length === 9) d = '998' + d
  if (d.length !== 12 || !d.startsWith('998')) return raw.trim()
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`
}

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', қ: 'q', л: 'l', м: 'm',
  н: 'n', о: 'o', ў: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ҳ: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
}
/** Ismdan login asosi: lotin kichik harflar (kirill ham o'giriladi), apostroflarsiz */
export function loginBase(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? ''
  const latin = [...first.toLowerCase()].map((ch) => CYR[ch] ?? ch).join('')
  const base = latin.replace(/[^a-z]/g, '').slice(0, 12)
  return base.length >= 2 ? base : 'ustoz'
}

/** aziza4567, band bo'lsa aziza4567_2, aziza4567_3 ... */
export function makeLogin(fullName: string, phone: string): string {
  const root = loginBase(fullName) + digits(phone).slice(-4)
  const taken = (l: string) =>
    l === config.adminLogin ||
    Boolean(db().prepare('SELECT 1 FROM teachers WHERE login = ?').get(l)) ||
    Boolean(db().prepare('SELECT 1 FROM directors WHERE login = ?').get(l))
  if (!taken(root)) return root
  for (let i = 2; ; i++) if (!taken(`${root}_${i}`)) return `${root}_${i}`
}

const tgUserOf = (initData: unknown): TelegramUser => {
  const u = verifyInitData(String(initData ?? ''), config.botToken)
  if (!u) fail(401, "Telegram ma'lumotlari tasdiqlanmadi. Ilovani botdan qayta oching.")
  return u!
}

export function saveContact(telegramId: number, phone: string) {
  db()
    .prepare('INSERT INTO tg_contacts (telegram_id, phone, saved_at) VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET phone = excluded.phone, saved_at = excluded.saved_at')
    .run(telegramId, formatPhone(phone), new Date().toISOString())
}
const contactOf = (telegramId: number) =>
  (db().prepare('SELECT phone FROM tg_contacts WHERE telegram_id = ?').get(telegramId) as { phone: string } | undefined)?.phone ?? null

const rowByTelegram = (telegramId: number) =>
  db().prepare('SELECT * FROM teachers WHERE telegram_id = ? ORDER BY status = \'active\' DESC').get(telegramId) as unknown as TeacherRow | undefined

export interface TgStatus {
  status: 'none' | 'pending' | 'rejected' | 'active'
  /** Botga ulashilgan (tasdiqlangan) raqam */
  phone: string | null
  /** Telegram profilidagi ism — formani to'ldirib qo'yish uchun */
  suggestedName: string
  firstName: string
  lastName: string
  login?: string
  fullName?: string
  branchId?: string
}

export function tgStatus(initData: unknown): TgStatus {
  const u = tgUserOf(initData)
  const row = rowByTelegram(u.id)
  return {
    status: row ? (row.status as TgStatus['status']) : 'none',
    phone: contactOf(u.id),
    suggestedName: [u.first_name, u.last_name].filter(Boolean).join(' '),
    firstName: u.first_name ?? '',
    lastName: u.last_name ?? '',
    ...(row && { login: row.login, fullName: row.full_name, branchId: row.branch_id }),
  }
}

/** Filialda tanlash mumkin bo'lgan fanlar (jadvaldan + xodimlardan) yoki bog'cha lavozimlari */
export function branchSubjects(branchId: string): { kind: 'subject' | 'position'; items: string[] } {
  const b = db().prepare('SELECT org FROM branches WHERE id = ?').get(branchId) as { org: Org } | undefined
  if (!b) fail(404, 'Filial topilmadi')
  const set = new Set<string>()
  for (const r of db().prepare('SELECT DISTINCT subject FROM lessons WHERE branch_id = ?').all(branchId) as { subject: string }[]) set.add(r.subject.trim())
  for (const r of db().prepare("SELECT subjects FROM teachers WHERE branch_id = ? AND status = 'active'").all(branchId) as { subjects: string }[]) {
    for (const s of JSON.parse(r.subjects) as string[]) set.add(s.trim())
  }
  set.delete('')
  const fromBranch = [...set].sort((a, c) => a.localeCompare(c, 'uz'))
  // Katalog tartibi saqlanadi, jadvaldagi katalogda yo'q fanlar oxiriga (katta-kichik harf farqi dublikat bo'lmasin)
  const merge = (base: string[]) => {
    const seen = new Set(base.map((s) => s.toLowerCase()))
    return [...base, ...fromBranch.filter((s) => !seen.has(s.toLowerCase()))]
  }
  if (b!.org === 'kindergarten') return { kind: 'position', items: merge(KINDERGARTEN_POSITIONS) }
  return { kind: 'subject', items: merge(SCHOOL_SUBJECTS) }
}

/** Ism-familiya tekshiruvi: xato matni yoki null */
export function nameError(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Ism va familiyangizni yozing. Masalan: Aziza Karimova'
  if (parts.length === 1) return `Familiyangizni ham yozing — ism va familiya birga. Masalan: «${parts[0]} Valiyev» yoki «${parts[0]} Karimova»`
  if (parts.some((p) => p.replace(/[^\p{L}]/gu, '').length < 2)) return "Ism va familiyani to'liq, harflar bilan yozing"
  return null
}

/** Qo'lda yozilgan raqam: "+998 90 123 45 67", "901234567" ... -> formatlangan yoki null */
export function parsePhone(raw: string): string | null {
  let d = digits(raw)
  if (d.length === 9) d = '998' + d
  return d.length === 12 && d.startsWith('998') ? formatPhone(d) : null
}

export const PHONE_HINT = "Raqam noto'g'ri. Masalan: +998 90 123 45 67"

/** Qo'lda yozilgan raqam bazadagi (Telegram'siz) xodimniki bo'lsa — faqat "Raqamni ulashish" bilan ulanadi */
export function phoneBelongsToExisting(phone: string): boolean {
  const key = phoneKey(phone)
  return (db().prepare("SELECT phone FROM teachers WHERE telegram_id IS NULL AND status != 'rejected' AND phone != ''").all() as { phone: string }[]).some(
    (t) => phoneKey(t.phone) === key,
  )
}

export interface Registration {
  telegramId: number
  fullName: string
  /** Raqam (formatlangan) */
  phone: string
  /** true — Telegram "Raqamni ulashish" orqali kelgan; false — qo'lda yozilgan */
  phoneVerified: boolean
  branchId: string
  subjects: string[]
  /** Lavozim "Mas'ul shaxs": direktor arizani tasdiqlasa, o'rinbosarni tasdiqlash huquqi ham bo'ladi */
  coordinator?: boolean
}

/** Ro'yxatdan o'tishning umumiy qismi (bot suhbati chaqiradi) */
export async function registerTelegramUser(r: Registration) {
  const fullName = r.fullName.trim().replace(/\s+/g, ' ')
  const subjects = [...new Set(r.subjects.map((s) => String(s).trim()).filter(Boolean))]
  const nameErr = nameError(fullName)
  if (nameErr) fail(400, nameErr)
  const phone = parsePhone(r.phone)
  if (!phone) fail(400, PHONE_HINT)
  if (!db().prepare('SELECT 1 FROM branches WHERE id = ?').get(r.branchId)) fail(400, 'Filialni tanlang')
  if (subjects.length === 0) fail(400, 'Kamida bittasini tanlang')
  // Faqat ro'yxatdagi fanlar — har kim har xil yozmasin
  const allowed = new Set(branchSubjects(r.branchId).items)
  if (subjects.some((s) => !allowed.has(s))) fail(400, "Fanni ro'yxatdan tanlang")
  const branchId = r.branchId

  const mine = rowByTelegram(r.telegramId)
  if (mine?.status === 'active') fail(409, "Siz allaqachon ro'yxatdan o'tgansiz")

  // 1) Shu Telegram bilan avval yuborilgan (kutilayotgan yoki rad etilgan) ariza — yangilanadi
  if (mine) {
    db()
      .prepare("UPDATE teachers SET full_name = ?, phone = ?, subjects = ?, branch_id = ?, is_coordinator = ?, status = 'pending' WHERE id = ?")
      .run(fullName, phone!, JSON.stringify(subjects), branchId, r.coordinator ? 1 : 0, mine.id)
    notify.teacherRegistered(mine.id)
    return { status: 'pending' as const, login: mine.login }
  }

  // 2) Telefon raqami bo'yicha mavjud (masalan davomatdan import qilingan) xodim — o'shanga bog'lanadi.
  //    Faqat Telegram tasdiqlagan raqam bilan: qo'lda yozilgan raqam bilan birovning hisobiga kirib bo'lmasin.
  const key = phoneKey(phone!)
  const existing = (db().prepare("SELECT * FROM teachers WHERE telegram_id IS NULL AND status != 'rejected' AND phone != ''").all() as unknown as TeacherRow[]).find(
    (t) => phoneKey(t.phone) === key,
  )
  if (existing && !r.phoneVerified) {
    // HttpError 409 — bot buni ushlab, telefon qadamiga qaytaradi
    fail(409, "Bu raqam bazada bor. Hisobingizga ulanish uchun «Raqamni ulashish» tugmasini bosing.")
  }
  const u = { id: r.telegramId }
  if (existing) {
    db().prepare('UPDATE teachers SET telegram_id = ? WHERE id = ?').run(u.id, existing.id)
    // Fanlari bo'sh bo'lsa — tanlaganini yozamiz; filial va ism rahbariyat kiritganicha qoladi
    if ((JSON.parse(existing.subjects) as string[]).length === 0) {
      db().prepare('UPDATE teachers SET subjects = ? WHERE id = ?').run(JSON.stringify(subjects), existing.id)
    }
    if (existing.status === 'active') {
      // Faol xodimni mas'ul qilish — faqat panelda (tasdiqsiz huquq berilmaydi)
      return { status: 'active' as const, login: existing.login, token: issueToken(existing.id, 'teacher'), teacherId: existing.id }
    }
    if (r.coordinator) db().prepare('UPDATE teachers SET is_coordinator = 1 WHERE id = ?').run(existing.id)
    notify.teacherRegistered(existing.id)
    return { status: 'pending' as const, login: existing.login }
  }

  // 3) Yangi xodim — tasdiq kutadi. Parol hali yo'q (tasdiqlanganda beriladi)
  const id = newId('t')
  const login = makeLogin(fullName, phone!)
  db()
    .prepare(
      `INSERT INTO teachers (id, full_name, login, password_hash, status, registered_at, phone, subjects, branch_id, telegram_id, password_pending, is_coordinator)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(id, fullName, login, await hashPassword(randomBytes(24).toString('hex')), localNow().date, phone!, JSON.stringify(subjects), branchId, u.id, r.coordinator ? 1 : 0)
  notify.teacherRegistered(id)
  return { status: 'pending' as const, login }
}

// ---------- Lavozim "Filial direktori": ariza -> umumiy rahbariyat panelda tasdiqlaydi ----------

export interface DirectorRequestRow {
  id: string
  telegram_id: number
  full_name: string
  phone: string
  branch_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

/** Botdan direktorlik arizasi. Bir odamning kutilayotgan arizasi bitta — qayta yuborsa yangilanadi */
export function requestDirector(r: { telegramId: number; fullName: string; phone: string; branchId: string }) {
  const fullName = r.fullName.trim().replace(/\s+/g, ' ')
  const nameErr = nameError(fullName)
  if (nameErr) fail(400, nameErr)
  const phone = parsePhone(r.phone)
  if (!phone) fail(400, PHONE_HINT)
  if (!db().prepare('SELECT 1 FROM branches WHERE id = ?').get(r.branchId)) fail(400, 'Filialni tanlang')
  const prev = db().prepare("SELECT id FROM director_requests WHERE telegram_id = ? AND status = 'pending'").get(r.telegramId) as { id: string } | undefined
  const id = prev?.id ?? newId('dr')
  if (prev) {
    db().prepare('UPDATE director_requests SET full_name = ?, phone = ?, branch_id = ?, created_at = ? WHERE id = ?').run(fullName, phone!, r.branchId, new Date().toISOString(), id)
  } else {
    db()
      .prepare("INSERT INTO director_requests (id, telegram_id, full_name, phone, branch_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)")
      .run(id, r.telegramId, fullName, phone!, r.branchId, new Date().toISOString())
  }
  notify.directorRequested(id)
  return { status: 'pending' as const }
}

export const directorRequestRow = (id: string) =>
  db().prepare('SELECT * FROM director_requests WHERE id = ?').get(id) as unknown as DirectorRequestRow | undefined

/** Panel uchun: kutilayotgan direktorlik arizalari */
export function listDirectorRequests() {
  const rows = db().prepare("SELECT * FROM director_requests WHERE status = 'pending' ORDER BY created_at").all() as unknown as DirectorRequestRow[]
  return rows.map((r) => {
    const b = db().prepare('SELECT name FROM branches WHERE id = ?').get(r.branch_id) as { name: string } | undefined
    const cur = db().prepare('SELECT full_name FROM directors WHERE branch_id = ?').get(r.branch_id) as { full_name: string } | undefined
    return {
      id: r.id,
      fullName: r.full_name,
      phone: r.phone,
      branchId: r.branch_id,
      branchName: (b?.name ?? '').replace(/\s+/g, ' '),
      currentDirector: cur?.full_name ?? null,
      createdAt: r.created_at,
    }
  })
}

/**
 * Tasdiqlansa: shu filial direktori shu odam bo'ladi (filialda direktor bo'lsa — almashtiriladi), Telegram ulanadi,
 * yangi login-parol yaratiladi va botga yuboriladi. Parol faqat xabarda — bazada hash.
 */
export async function decideDirectorRequest(id: string, approve: boolean) {
  const r = directorRequestRow(id)
  if (!r) fail(404, 'Ariza topilmadi')
  if (r!.status !== 'pending') fail(409, "Bu ariza allaqachon ko'rib chiqilgan")
  if (!approve) {
    db().prepare("UPDATE director_requests SET status = 'rejected' WHERE id = ?").run(id)
    notify.directorDecided(id, false)
    return { ok: true }
  }
  const password = String(randomInt(100000, 1000000))
  const hash = await hashPassword(password)
  const existing = db().prepare('SELECT id, login, telegram_id FROM directors WHERE branch_id = ?').get(r!.branch_id) as
    | { id: string; login: string; telegram_id: number | null }
    | undefined
  // Shu odam allaqachon shu filial direktori bo'lsa — loginini saqlaymiz
  const login = existing && existing.telegram_id === r!.telegram_id ? existing.login : makeLogin(r!.full_name, r!.phone)
  if (existing) {
    db()
      .prepare('UPDATE directors SET full_name = ?, login = ?, password_hash = ?, phone = ?, telegram_id = ? WHERE id = ?')
      .run(r!.full_name, login, hash, r!.phone, r!.telegram_id, existing.id)
  } else {
    db()
      .prepare('INSERT INTO directors (id, full_name, login, password_hash, phone, branch_id, telegram_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(newId('d'), r!.full_name, login, hash, r!.phone, r!.branch_id, r!.telegram_id, localNow().date)
  }
  db().prepare("UPDATE director_requests SET status = 'approved' WHERE id = ?").run(id)
  notify.directorDecided(id, true, { login, password })
  return { ok: true }
}

/**
 * Mini App ochildi, xodim hali ro'yxatdan o'tmagan: ro'yxat bot CHATIDA bo'ladi —
 * bot shu odamga birinchi savolni yuboradi, Mini App esa yopilib chatga qaytadi.
 */
export function requestChatRegistration(initData: unknown) {
  const u = tgUserOf(initData)
  const row = rowByTelegram(u.id)
  if (row?.status === 'active') fail(409, "Siz allaqachon ro'yxatdan o'tgansiz")
  if (row?.status === 'pending') fail(409, 'Arizangiz direktorda ko\'rib chiqilmoqda')
  notify.registrationRequested(u.id)
  return { ok: true }
}

/** Yangi 6 xonali parol yaratadi (kompyuterdan saytga kirish uchun) va qaytaradi */
export async function issuePassword(teacherId: string): Promise<string> {
  const password = String(randomInt(100000, 1000000))
  db().prepare('UPDATE teachers SET password_hash = ?, password_pending = 0 WHERE id = ?').run(await hashPassword(password), teacherId)
  return password
}

/** Rahbariyat/direktor/mas'ul arizani tasdiqlaydi yoki rad etadi */
export function decideTeacher(id: string, status: 'active' | 'rejected') {
  const before = teacherRow(id)
  if (!before) fail(404, "O'qituvchi topilmadi")
  db().prepare('UPDATE teachers SET status = ? WHERE id = ?').run(status, id)
  if (before!.status !== status) notify.teacherDecided(id, status)
  return getTeacher(id)
}

/** Bot tugmasi: kim tasdiqlay oladi — shu filial direktori yoki mas'uli */
export function canDecide(telegramId: number, teacherId: string): boolean {
  const t = teacherRow(teacherId)
  if (!t) return false
  if (db().prepare('SELECT 1 FROM directors WHERE telegram_id = ? AND branch_id = ?').get(telegramId, t.branch_id)) return true
  return Boolean(
    db().prepare("SELECT 1 FROM teachers WHERE telegram_id = ? AND branch_id = ? AND is_coordinator = 1 AND status = 'active'").get(telegramId, t.branch_id),
  )
}
