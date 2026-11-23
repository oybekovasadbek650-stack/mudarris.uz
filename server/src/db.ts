// SQLite baza (Node o'rnatilgan node:sqlite). Jadvallar Excel fayl varaqlariga mos:
// "Filial va qoidalar" -> branches + settings, "Qo'ng'iroqlar" -> bells,
// "O'qituvchilar" -> teachers, "Dars jadvali" -> lessons.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS branches (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org  TEXT NOT NULL DEFAULT 'school'
);
CREATE TABLE IF NOT EXISTS bells (
  branch_id  TEXT NOT NULL REFERENCES branches(id),
  para       INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  PRIMARY KEY (branch_id, para)
);
CREATE TABLE IF NOT EXISTS teachers (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL,
  login          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  registered_at  TEXT NOT NULL,
  phone          TEXT NOT NULL DEFAULT '',
  subjects       TEXT NOT NULL DEFAULT '[]',
  extra_subjects TEXT NOT NULL DEFAULT '[]',
  branch_id      TEXT NOT NULL REFERENCES branches(id),
  telegram_id    INTEGER,
  is_coordinator INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons (
  id         TEXT PRIMARY KEY,
  branch_id  TEXT NOT NULL REFERENCES branches(id),
  weekday    INTEGER NOT NULL,
  para       INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  class_name TEXT NOT NULL,
  subject    TEXT NOT NULL,
  room       TEXT NOT NULL DEFAULT '',
  teacher_id TEXT NOT NULL REFERENCES teachers(id)
);
CREATE INDEX IF NOT EXISTS lessons_teacher ON lessons(teacher_id, weekday);
CREATE TABLE IF NOT EXISTS settings (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS absences (
  id         TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  date       TEXT NOT NULL,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  late       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS absences_date ON absences(date);
-- lesson_json: dars nusxasi. Jadval qayta yuklansa ham eski holatlar buzilmaydi.
CREATE TABLE IF NOT EXISTS cases (
  id                TEXT PRIMARY KEY,
  absence_id        TEXT NOT NULL REFERENCES absences(id),
  date              TEXT NOT NULL,
  lesson_json       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  chosen_teacher_id TEXT REFERENCES teachers(id)
);
CREATE INDEX IF NOT EXISTS cases_date ON cases(date);
CREATE TABLE IF NOT EXISTS offers (
  id           TEXT PRIMARY KEY,
  case_id      TEXT NOT NULL REFERENCES cases(id),
  teacher_id   TEXT NOT NULL REFERENCES teachers(id),
  rank         INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TEXT NOT NULL,
  responded_at TEXT
);
CREATE INDEX IF NOT EXISTS offers_teacher ON offers(teacher_id);
CREATE INDEX IF NOT EXISTS offers_case ON offers(case_id);
-- Filial direktori: o'z filialini panelda boshqaradi, o'rinbosarni tasdiqlaydi
CREATE TABLE IF NOT EXISTS directors (
  id            TEXT PRIMARY KEY,
  full_name     TEXT NOT NULL,
  login         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  branch_id     TEXT NOT NULL UNIQUE REFERENCES branches(id),
  telegram_id   INTEGER,
  created_at    TEXT NOT NULL
);
-- Davomat bo'yicha "kelmadi" tekshiruvi: bir ustoz uchun kuniga bitta yozuv
-- stage: asked (botda so'raldi) | coming (kelyapman dedi) | present (davomatda keldi)
--        | escalated (direktor/mas'ulga xabar) | absence_created (ariza ochildi)
CREATE TABLE IF NOT EXISTS attendance_checks (
  teacher_id   TEXT NOT NULL REFERENCES teachers(id),
  date         TEXT NOT NULL,
  stage        TEXT NOT NULL,
  reason       TEXT,
  asked_at     TEXT,
  escalated_at TEXT,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (teacher_id, date)
);
-- Sozlamalarni qayta belgilash: scope = 'org:school' | 'org:academy' | 'org:kindergarten' | 'branch:<id>'
-- value — faqat o'zgartirilgan maydonlar (JSON); qolgani yuqori darajadan meros
CREATE TABLE IF NOT EXISTS settings_overrides (
  scope TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Telegram'ni bog'lash uchun bir martalik kodlar (t.me/bot?start=link_<code>)
CREATE TABLE IF NOT EXISTS link_codes (
  code       TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
-- Botga "Raqamni ulashish" orqali kelgan (Telegram tasdiqlagan) telefon raqamlari
CREATE TABLE IF NOT EXISTS tg_contacts (
  telegram_id INTEGER PRIMARY KEY,
  phone       TEXT NOT NULL,
  saved_at    TEXT NOT NULL
);
-- Botda "Filial direktori" lavozimi bilan ro'yxatdan o'tganlar: faqat umumiy rahbariyat panelda tasdiqlaydi
CREATE TABLE IF NOT EXISTS director_requests (
  id          TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  branch_id   TEXT NOT NULL REFERENCES branches(id),
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL
);
-- Bot suhbatida ro'yxatdan o'tish: qaysi qadamda turgani va kiritilganlar (server qayta ishga tushsa ham saqlanadi)
CREATE TABLE IF NOT EXISTS tg_reg_sessions (
  telegram_id INTEGER PRIMARY KEY,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
`

/** Eski bazalarga yangi ustunlar (SQLite'da ADD COLUMN IF NOT EXISTS yo'q) */
function migrate(db: DatabaseSync) {
  const has = (table: string, col: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col)
  // Kim tasdiqladi: "Direktor: Ism" / "Mas'ul: Ism" / "Rahbariyat"
  if (!has('cases', 'chosen_by')) db.exec('ALTER TABLE cases ADD COLUMN chosen_by TEXT')
  // Davomat tizimi bilan bog'lanish: filial = davomatdagi department id, o'qituvchi = davomatdagi xodim kodi
  if (!has('branches', 'davomat_id')) db.exec('ALTER TABLE branches ADD COLUMN davomat_id INTEGER')
  if (!has('teachers', 'davomat_code')) db.exec('ALTER TABLE teachers ADD COLUMN davomat_code TEXT')
  // Bot orqali ro'yxatdan o'tgan: paroli hali berilmagan — tasdiqlanganda yaratilib botga yuboriladi
  if (!has('teachers', 'password_pending')) db.exec('ALTER TABLE teachers ADD COLUMN password_pending INTEGER NOT NULL DEFAULT 0')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS branches_davomat ON branches(davomat_id) WHERE davomat_id IS NOT NULL')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS teachers_davomat ON teachers(davomat_code) WHERE davomat_code IS NOT NULL')
}

let current: DatabaseSync | undefined

/** Bazani ochadi (yoki ':memory:' — testlar uchun) va jadvallarni yaratadi */
export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA)
  migrate(db)
  current = db
  return db
}

export function db(): DatabaseSync {
  if (!current) throw new Error('Baza ochilmagan: avval openDb() chaqiring')
  return current
}

/** Bir nechta yozuvni bitta tranzaksiyada bajarish */
export function tx<T>(fn: () => T): T {
  const d = db()
  d.exec('BEGIN')
  try {
    const result = fn()
    d.exec('COMMIT')
    return result
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
}

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
