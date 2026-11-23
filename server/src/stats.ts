// Panel "Bugungi holat" uchun: 7 kunlik trend va yaqin kunlardagi arizalar
import { db } from './db.ts'
import { orgOf, teacherRow, type AbsenceRow, type CaseRow } from './repo.ts'
import { localNow } from './time.ts'
import type { DashboardStats, Org } from '../../src/types.ts'

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function absencesOn(date: string, branchId?: string, org?: Org) {
  const rows = db().prepare('SELECT * FROM absences WHERE date = ? ORDER BY created_at').all(date) as unknown as AbsenceRow[]
  return rows
    .map((a) => ({ a, t: teacherRow(a.teacher_id) }))
    .filter(({ t }) => t && (!branchId || t.branch_id === branchId) && (!org || orgOf(t.branch_id) === org))
}

function caseCounts(absenceId: string) {
  const cases = db().prepare('SELECT status FROM cases WHERE absence_id = ?').all(absenceId) as unknown as Pick<CaseRow, 'status'>[]
  return {
    found: cases.filter((c) => c.status === 'found').length,
    pending: cases.filter((c) => c.status === 'pending').length,
    notFound: cases.filter((c) => c.status === 'not_found').length,
  }
}

/** to — oxirgi kun (odatda tanlangan sana): undan oldingi 6 kun + o'zi; yaqin kunlar — bugundan keyingi 7 kun */
export function dashboardStats(to: string, branchId?: string, org?: Org, days = 7): DashboardStats {
  const week = Array.from({ length: days }, (_, i) => addDays(to, i - (days - 1))).map((date) => {
    const list = absencesOn(date, branchId, org)
    const sum = { found: 0, pending: 0, notFound: 0 }
    for (const { a } of list) {
      const c = caseCounts(a.id)
      sum.found += c.found
      sum.pending += c.pending
      sum.notFound += c.notFound
    }
    return { date, absences: list.length, ...sum }
  })

  const today = localNow().date
  const upcoming = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).flatMap((date) =>
    absencesOn(date, branchId, org).map(({ a, t }) => ({
      date,
      absenceId: a.id,
      teacherName: t!.full_name,
      branchId: t!.branch_id,
      reason: a.reason,
      ...caseCounts(a.id),
    })),
  )
  return { week, upcoming }
}
