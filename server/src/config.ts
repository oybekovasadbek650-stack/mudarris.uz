const env = process.env

export const config = {
  port: Number(env.PORT ?? 8787),
  dbPath: env.DB_PATH ?? 'data/orinbosar.db',
  jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
  adminLogin: (env.ADMIN_LOGIN ?? 'admin').toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD ?? 'admin123',
  corsOrigin: (env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  botToken: env.BOT_TOKEN ?? '',
  webAppUrl: env.WEBAPP_URL ?? '',
  miniAppLink: env.MINIAPP_LINK ?? '',
  /** Davomat tizimi (Xodim Plus API) — filiallar va xodimlarni olish uchun. Bo'sh bo'lsa integratsiya o'chiq */
  davomatUrl: (env.DAVOMAT_URL ?? '').replace(/\/$/, ''),
  davomatLogin: env.DAVOMAT_LOGIN ?? '',
  davomatPassword: env.DAVOMAT_PASSWORD ?? '',
}

/** Ishga tushgandan keyin aniqlanadigan qiymatlar */
export const runtime = {
  /** Bot username (bot ishga tushganda to'ldiriladi) — Telegram ulash havolasi uchun */
  botUsername: '',
}

if (env.NODE_ENV === 'production' && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET o\'rnatilmagan')
}
