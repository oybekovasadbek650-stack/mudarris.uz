// Kirish tokenlari. O'qituvchi va rahbariyat tokenlari ALOHIDA saqlanadi —
// shuning uchun bir brauzerda bir oynada o'qituvchi, boshqasida admin bo'lib kirish mumkin.
// localStorage ishlamasa (masalan, maxfiy rejim) — faqat xotirada turadi.
import type { Role } from '../types'

// Direktor ham panelga kiradi — uning tokeni rahbariyat tokeni o'rnida saqlanadi (scope = /admin)
type Scope = 'admin' | 'teacher'
const scopeOf = (role: Role): Scope => (role === 'teacher' ? 'teacher' : 'admin')
const keyOf = (role: Role) => `token:${scopeOf(role)}`
const memory: Partial<Record<Scope, string>> = {}

/** Joriy sahifa qaysi qismga tegishli: /admin... -> admin, qolgani -> teacher */
export const currentScope = (): Role => (window.location.pathname.startsWith('/admin') ? 'admin' : 'teacher')

export function getToken(role: Role = currentScope()) {
  const s = scopeOf(role)
  if (memory[s]) return memory[s]
  try {
    memory[s] = localStorage.getItem(keyOf(role)) ?? undefined
  } catch {
    /* localStorage yopiq */
  }
  return memory[s] ?? null
}

export function setToken(token: string, role: Role) {
  memory[scopeOf(role)] = token
  try {
    localStorage.setItem(keyOf(role), token)
  } catch {
    /* localStorage yopiq */
  }
}

export function clearToken(role: Role = currentScope()) {
  delete memory[scopeOf(role)]
  try {
    localStorage.removeItem(keyOf(role))
  } catch {
    /* localStorage yopiq */
  }
}
