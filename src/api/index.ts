import type { Api } from './contract'
import { httpApi } from './http'
import { mockApi } from './mock'

/** .env da VITE_USE_MOCK=false qilinsa — haqiqiy backend, aks holda soxta ma'lumotlar */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export const api: Api = USE_MOCK ? mockApi : httpApi
