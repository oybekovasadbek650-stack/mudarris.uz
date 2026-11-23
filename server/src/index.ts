import { serve } from '@hono/node-server'
import { config } from './config.ts'
import { openDb } from './db.ts'
import { app } from './routes.ts'
import { startBot } from './bot.ts'
import { expireStaleOffers } from './logic.ts'
import { attendanceSweep } from './attendance.ts'

openDb(config.dbPath)
const bot = startBot()

// Javob berish muddati o'tgan takliflarni har 30 soniyada yopib, navbatdagi nomzodga o'tamiz
const sweep = () => {
  try {
    const { expired } = expireStaleOffers()
    if (expired.length) console.log(`Muddati o'tgan takliflar: ${expired.length}`)
  } catch (e) {
    console.error('Takliflar muddatini tekshirishda xato:', e)
  }
}
sweep()
const sweepTimer = setInterval(sweep, 30_000)

// Davomat bo'yicha "kelmadi" tekshiruvi — har daqiqada (oldingisi tugamagan bo'lsa o'tkazib yuboriladi)
let attendanceBusy = false
let lastAttendanceError = ''
const attendanceTimer = setInterval(async () => {
  if (attendanceBusy) return
  attendanceBusy = true
  try {
    const r = await attendanceSweep()
    lastAttendanceError = ''
    if (r.asked.length || r.escalated.length) console.log(`Davomat: so'raldi ${r.asked.length}, xabar berildi ${r.escalated.length}`)
  } catch (e) {
    // Davomat serveri o'chiq bo'lsa har daqiqada bir xil xatoni yozib to'ldirmaymiz
    const msg = e instanceof Error ? e.message : String(e)
    if (msg !== lastAttendanceError) console.error('Davomat tekshiruvi:', msg)
    lastAttendanceError = msg
  } finally {
    attendanceBusy = false
  }
}, 60_000)

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`API: http://localhost:${info.port}/api`)
})

const stop = () => {
  clearInterval(sweepTimer)
  clearInterval(attendanceTimer)
  void bot?.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
