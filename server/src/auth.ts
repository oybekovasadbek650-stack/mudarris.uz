// Tokenlar (HMAC imzoli), parollar (bcrypt) va Telegram Mini App initData tekshiruvi.
import { createHmac, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { config } from './config.ts'
import type { Role } from '../../src/types.ts'

export interface TokenPayload {
  sub: string // foydalanuvchi id (admin uchun "admin")
  role: Role
  exp: number // unix soniya
}

const TOKEN_TTL_SEC = 30 * 24 * 3600
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')
const sign = (data: string) => createHmac('sha256', config.jwtSecret).update(data).digest('base64url')

export function issueToken(sub: string, role: Role): string {
  const payload: TokenPayload = { sub, role, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }
  const body = b64(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

export function verifyToken(token: string): TokenPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig || !safeEqual(sig, sign(body))) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload
    return p.exp > Date.now() / 1000 ? p : null
  } catch {
    return null
  }
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10)
export const checkPassword = (p: string, hash: string) => bcrypt.compare(p, hash)

export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

/**
 * Mini App yuborgan initData ni bot tokeni bilan tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSec = 24 * 3600): TelegramUser | null {
  if (!botToken || !initData) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(dataCheck).digest('hex')
  if (!safeEqual(hash, expected)) return null
  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null
  try {
    const user = JSON.parse(params.get('user') ?? '') as TelegramUser
    return typeof user?.id === 'number' ? user : null
  } catch {
    return null
  }
}
