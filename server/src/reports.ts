// 3-bosqich: oylik hisobot = o'rinbosar tizimi (arizalar, o'rinbosar darslar, haq) + davomat (kelgan, kechikish, ish vaqti).
// Asosiy yangi ko'rsatkich — "sababsiz kelmagan" kunlar: davomatda kirish yo'q va tizimda "Kela olmayman" arizasi ham yo'q.
// Davomat ishlamasa — hisobot baribir chiqadi (davomat ustunlarisiz) va sababi qaytariladi.
import { db } from './db.ts'
import { monthlyReport } from './logic.ts'
import { HttpError } from './repo.ts'
import { davomatAbsentDates, davomatEmployeeId, davomatEnabled, davomatMonthly } from './davomat.ts'
import { localNow } from './time.ts'
import type { MonthlyReport } from '../../src/types.ts'

/** Oyning oxirgi kuni */
function monthEnd(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export async function combinedMonthlyReport(month: string, branchId?: string): Promise<MonthlyReport> {
  const rows = monthlyReport(month, branchId)
  const result: MonthlyReport = { month, rows, davomat: { enabled: davomatEnabled(), ok: false } }
  if (!davomatEnabled() || rows.length === 0) return result

  const codes = new Map(
    (db().prepare('SELECT id, davomat_code, branch_id FROM teachers WHERE davomat_code IS NOT NULL').all() as {
      id: string
      davomat_code: string
      branch_id: string
    }[]).map((t) => [t.id, davomatEmployeeId(t.davomat_code)]),
  )
  if (!rows.some((r) => codes.has(r.teacherId))) return { ...result, davomat: { enabled: true, ok: true } }

  // Kelajak oy uchun davomatda ma'lumot bo'lmaydi
  const today = localNow().date
  if (`${month}-01` > today) return { ...result, davomat: { enabled: true, ok: true } }

  try {
    const to = monthEnd(month) < today ? monthEnd(month) : today
    const [monthly, absent] = await Promise.all([davomatMonthly(month), davomatAbsentDates(`${month}-01`, to)])
    const byEmp = new Map(monthly.rows.map((r) => [String(r.employee.id), r]))
    // Ariza berilgan kunlar (sababli)
    const excused = new Map<string, Set<string>>()
    for (const a of db().prepare('SELECT teacher_id, date FROM absences WHERE date LIKE ?').all(`${month}%`) as { teacher_id: string; date: string }[]) {
      excused.set(a.teacher_id, (excused.get(a.teacher_id) ?? new Set()).add(a.date))
    }
    for (const r of rows) {
      const empId = codes.get(r.teacherId)
      const d = empId ? byEmp.get(empId) : undefined
      if (!empId || !d) continue
      const ex = excused.get(r.teacherId) ?? new Set()
      r.davomat = {
        workingDays: d.workingDays,
        presentDays: d.presentDays,
        absentDays: d.absentDays,
        lateDays: d.lateDays,
        lateMinutes: d.lateMinutes,
        workedMinutes: d.workedMinutes,
        unexplainedAbsentDates: (absent.get(empId) ?? []).filter((date) => date < today && !ex.has(date)).sort(),
      }
    }
    return { ...result, davomat: { enabled: true, ok: true } }
  } catch (e) {
    return { ...result, davomat: { enabled: true, ok: false, error: e instanceof HttpError ? e.message : "Davomat ma'lumotini olib bo'lmadi" } }
  }
}
