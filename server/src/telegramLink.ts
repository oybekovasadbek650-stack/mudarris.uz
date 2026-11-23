// Telegram akkauntni hisobga bog'lash: panel/ilova bir martalik havola beradi,
// foydalanuvchi uni bosib botni ochadi (/start link_<kod>) — bot telegram_id ni yozib qo'yadi.
// Mini App (HTTPS) kerak emas, shuning uchun lokal va test muhitida ham ishlaydi.
import { randomBytes } from 'node:crypto'
import { db, tx } from './db.ts'
import { runtime } from './config.ts'
import { fail } from './repo.ts'
import { clock } from './time.ts'

export type LinkKind = 'teacher' | 'director'
const TTL_MIN = 15
const TABLE: Record<LinkKind, string> = { teacher: 'teachers', director: 'directors' }

export function createLinkUrl(kind: LinkKind, userId: string): { url: string; expiresInMinutes: number } {
  if (!runtime.botUsername) fail(503, "Telegram bot hozir ishlamayapti. Keyinroq urinib ko'ring.")
  const code = randomBytes(12).toString('base64url')
  const expires = new Date(clock.now().getTime() + TTL_MIN * 60_000).toISOString()
  db().prepare('DELETE FROM link_codes WHERE user_id = ? OR expires_at < ?').run(userId, clock.now().toISOString())
  db().prepare('INSERT INTO link_codes (code, kind, user_id, expires_at) VALUES (?, ?, ?, ?)').run(code, kind, userId, expires)
  return { url: `https://t.me/${runtime.botUsername}?start=link_${code}`, expiresInMinutes: TTL_MIN }
}

/** Kod to'g'ri bo'lsa — Telegram id ni bog'laydi va ism qaytaradi; bo'lmasa null */
export function consumeLinkCode(code: string, telegramId: number): { kind: LinkKind; fullName: string } | null {
  const row = db().prepare('SELECT * FROM link_codes WHERE code = ?').get(code) as
    | { code: string; kind: LinkKind; user_id: string; expires_at: string }
    | undefined
  if (!row || row.expires_at < clock.now().toISOString() || !(row.kind in TABLE)) return null
  const table = TABLE[row.kind]
  return tx(() => {
    db().prepare('DELETE FROM link_codes WHERE code = ?').run(code)
    // Bitta Telegram akkaunt bitta turdagi bitta hisobga bog'lanadi
    db().prepare(`UPDATE ${table} SET telegram_id = NULL WHERE telegram_id = ? AND id != ?`).run(telegramId, row.user_id)
    db().prepare(`UPDATE ${table} SET telegram_id = ? WHERE id = ?`).run(telegramId, row.user_id)
    const r = db().prepare(`SELECT full_name FROM ${table} WHERE id = ?`).get(row.user_id) as { full_name: string } | undefined
    return r ? { kind: row.kind, fullName: r.full_name } : null
  })
}
