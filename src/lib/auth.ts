// Kirish tokenlari. O'qituvchi va rahbariyat tokenlari ALOHIDA saqlanadi —
// shuning uchun bir brauzerda bir oynada o'qituvchi, boshqasida admin bo'lib kirish mumkin.
// localStorage ishlamasa (masalan, maxfiy rejim) — faqat xotirada turadi.
import type { Role } from '../types'

const keyOf = (role: Role) => `token:${role}`
const memory: Partial<Record<Role, string>> = {}

/** Joriy sahifa qaysi qismga tegishli: /admin... -> admin, qolgani -> teacher */
export const currentScope = (): Role => (window.location.pathname.startsWith('/admin') ? 'admin' : 'teacher')

export function getToken(role: Role = currentScope()) {
  if (memory[role]) return memory[role]
  try {
    memory[role] = localStorage.getItem(keyOf(role)) ?? undefined
  } catch {
    /* localStorage yopiq */
  }
  return memory[role] ?? null
}

export function setToken(token: string, role: Role) {
  memory[role] = token
  try {
    localStorage.setItem(keyOf(role), token)
  } catch {
    /* localStorage yopiq */
  }
}

export function clearToken(role: Role = currentScope()) {
  delete memory[role]
  try {
    localStorage.removeItem(keyOf(role))
  } catch {
    /* localStorage yopiq */
  }
}
