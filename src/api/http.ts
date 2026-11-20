// HAQIQIY API — backendga so'rov yuboradi. Endpointlar ro'yxati: docs/api.md
import type { Api } from './contract'
import { clearToken, getToken } from '../lib/auth'
import { tg } from '../lib/telegram'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (res.status === 401 && token) {
    // Token eskirgan — chiqib, kirish sahifasiga qaytamiz
    clearToken()
    window.location.assign(window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login')
  }
  if (!res.ok) {
    let message = `Server xatosi (${res.status})`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      /* javob JSON emas */
    }
    throw new Error(message)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

const get = <T,>(path: string) => request<T>(path)
const send = <T,>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
const qs = (params: Record<string, string | undefined>) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v && p.set(k, v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const httpApi: Api = {
  // Telegram ichida kirilsa initData ham yuboriladi — backend shu Telegram akkauntni o'qituvchiga bog'laydi
  login: (login, password) => send('POST', '/auth/login', { login, password, initData: tg?.initData || undefined }),
  register: (input) => send('POST', '/auth/register', input),
  getBranches: () => get('/branches'),

  getMe: () => get('/me'),
  getMyLessons: (date) => get(`/me/lessons${qs({ date })}`),
  getMyOffers: () => get('/me/offers'),
  respondOffer: (id, accept) => send('POST', `/offers/${id}/${accept ? 'accept' : 'reject'}`),
  getMySubstitutions: () => get('/me/substitutions'),
  createAbsence: (input) => send('POST', '/absences', input),

  getCases: () => get('/cases'),
  getCase: (id) => get(`/cases/${id}`),
  chooseCandidate: (caseId, teacherId) => send('POST', `/cases/${caseId}/choose`, { teacherId }),

  getDayOverview: (date, branchId) => get(`/admin/overview${qs({ date, branchId })}`),
  getSchedule: (branchId) => get(`/admin/schedule${qs({ branchId })}`),
  importSchedule: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/admin/schedule/import', { method: 'POST', body: form })
  },
  getTeachers: () => get('/admin/teachers'),
  saveTeacher: ({ id, ...rest }) => send('PUT', `/admin/teachers/${id}`, rest),
  approveTeacher: (id) => send('POST', `/admin/teachers/${id}/approve`),
  rejectTeacher: (id) => send('POST', `/admin/teachers/${id}/reject`),
  getSettings: () => get('/admin/settings'),
  saveSettings: (s) => send('PUT', '/admin/settings', s),
  getMonthlyReport: (month) => get(`/admin/reports/monthly${qs({ month })}`),
}
