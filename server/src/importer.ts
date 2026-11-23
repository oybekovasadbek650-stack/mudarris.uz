// Excel'dan bazaga yozish.
//  - seedFromWorkbook: bo'sh bazani to'liq to'ldiradi (filial, qoidalar, qo'ng'iroqlar, o'qituvchilar, darslar)
//  - importSchedule:   admin paneldan "Excel fayldan yuklash" — faqat dars jadvalini (va qo'ng'iroqlarni) yangilaydi
import { db, newId, tx } from './db.ts'
import { hashPassword } from './auth.ts'
import { DEFAULT_SETTINGS, getSettings, putSettings } from './repo.ts'
import { localNow } from './time.ts'
import { norm, rulesToSettings, type ParsedWorkbook } from './excel.ts'
import { nameKey } from './davomat.ts'

const DEFAULT_BELLS: [string, string][] = [
  ['08:30', '09:15'],
  ['09:20', '10:05'],
  ['10:15', '11:00'],
  ['11:10', '11:55'],
  ['12:00', '12:45'],
  ['12:50', '13:35'],
  ['13:40', '14:25'],
]

function bellsOf(branchId: string) {
  const rows = db().prepare('SELECT para, start_time, end_time FROM bells WHERE branch_id = ?').all(branchId) as {
    para: number
    start_time: string
    end_time: string
  }[]
  const map = new Map(rows.map((r) => [r.para, [r.start_time, r.end_time] as [string, string]]))
  return (para: number): [string, string] => map.get(para) ?? DEFAULT_BELLS[para - 1] ?? ['', '']
}

function writeBells(branchId: string, bells: ParsedWorkbook['bells']) {
  if (bells.length === 0) return
  db().prepare('DELETE FROM bells WHERE branch_id = ?').run(branchId)
  const ins = db().prepare('INSERT INTO bells (branch_id, para, start_time, end_time) VALUES (?, ?, ?, ?)')
  for (const b of bells) ins.run(branchId, b.para, b.start, b.end)
}

/** Darslarni yozadi. O'qituvchi F.I.Sh. bo'yicha topiladi. Faqat tegishli filiallar darslari almashtiriladi. */
function writeLessons(wb: ParsedWorkbook, errors: string[], onlyBranchId?: string): number {
  const teachers = db().prepare("SELECT id, full_name, branch_id FROM teachers WHERE status != 'rejected'").all() as {
    id: string
    full_name: string
    branch_id: string
  }[]
  // "Abdulhamid A'zamov" = "Aʼzamov Abdulhamid": so'zlar tartibi va apostroflarsiz solishtiriladi
  const byName = new Map(teachers.map((t) => [nameKey(t.full_name), t]))
  const resolved = wb.lessons.flatMap((l) => {
    const t = byName.get(nameKey(l.teacherName))
    if (!t) {
      errors.push(`${l.row}-qator: "${l.teacherName}" ismli o'qituvchi tizimda yo'q`)
      return []
    }
    if (onlyBranchId && t.branch_id !== onlyBranchId) {
      errors.push(`${l.row}-qator: "${l.teacherName}" sizning filialingiz o'qituvchisi emas`)
      return []
    }
    return [{ ...l, teacherId: t.id, branchId: t.branch_id }]
  })
  // Bitta ustozning bir vaqtda ikki darsi bo'lmasin
  const seen = new Set<string>()
  const clean = resolved.filter((l) => {
    const key = `${l.teacherId}|${l.weekday}|${l.para}`
    if (seen.has(key)) {
      errors.push(`${l.row}-qator: ${l.teacherName} bu vaqtda boshqa darsda (takror)`)
      return false
    }
    seen.add(key)
    return true
  })
  if (clean.length === 0) return 0

  const branchIds = [...new Set(clean.map((l) => l.branchId))]
  for (const b of branchIds) {
    writeBells(b, wb.bells)
    db().prepare('DELETE FROM lessons WHERE branch_id = ?').run(b)
  }
  const ins = db().prepare(
    'INSERT INTO lessons (id, branch_id, weekday, para, start_time, end_time, class_name, subject, room, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const bellFor = new Map(branchIds.map((b) => [b, bellsOf(b)]))
  for (const l of clean) {
    const [start, end] = bellFor.get(l.branchId)!(l.para)
    ins.run(newId('l'), l.branchId, l.weekday, l.para, start, end, l.className, l.subject, l.room, l.teacherId)
  }

  // Fanlari kiritilmagan o'qituvchilar (masalan, davomatdan olinganlar) — fanlar o'z darslaridan to'ldiriladi
  const subjectsOf = new Map<string, Set<string>>()
  for (const l of clean) subjectsOf.set(l.teacherId, (subjectsOf.get(l.teacherId) ?? new Set()).add(l.subject))
  const fill = db().prepare("UPDATE teachers SET subjects = ? WHERE id = ? AND subjects = '[]'")
  for (const [teacherId, subjects] of subjectsOf) fill.run(JSON.stringify([...subjects]), teacherId)

  return clean.length
}

/** onlyBranchId — direktor uchun: faqat o'z filiali ustozlarining darslari yoziladi */
export function importSchedule(wb: ParsedWorkbook, onlyBranchId?: string) {
  const errors = [...wb.errors]
  const imported = tx(() => writeLessons(wb, errors, onlyBranchId))
  return { imported, errors }
}

/** Bo'sh bazani Excel bo'yicha to'ldiradi. Login: ustoz1, ustoz2 ... (ID ustunidagi raqam bo'yicha) */
export async function seedFromWorkbook(wb: ParsedWorkbook, password: string) {
  const errors = [...wb.errors]
  const rules = rulesToSettings(wb.rules)
  const hash = await hashPassword(password)
  const today = localNow().date

  const result = tx(() => {
    // Filiallar: qoidalardagi nom + o'qituvchilar varag'idagi filial nomlari
    const branchNames = [...new Set([rules.branchName, ...wb.teachers.map((t) => t.branchName).filter(Boolean)])]
    const branchId = new Map<string, string>()
    for (const name of branchNames) {
      const existing = db().prepare('SELECT id FROM branches WHERE name = ?').get(name) as { id: string } | undefined
      const id = existing?.id ?? newId('b')
      if (!existing) db().prepare("INSERT INTO branches (id, name, org) VALUES (?, ?, 'school')").run(id, name)
      branchId.set(norm(name), id)
    }

    putSettings({
      ...DEFAULT_SETTINGS,
      ...getSettings(),
      ...(rules.dailyLimit !== undefined && { dailyLimit: rules.dailyLimit }),
      ...(rules.noticeDeadline !== undefined && { noticeDeadline: rules.noticeDeadline }),
      ...(rules.allowCrossBranch !== undefined && { allowCrossBranch: rules.allowCrossBranch }),
      paymentPerLesson: rules.paymentPerLesson,
    })

    const accounts: { login: string; fullName: string }[] = []
    wb.teachers.forEach((t, i) => {
      const num = /(\d+)/.exec(t.code)?.[1] ?? String(i + 1)
      const login = `ustoz${num}`
      const bId = branchId.get(norm(t.branchName || rules.branchName))!
      const existing = db().prepare('SELECT id FROM teachers WHERE login = ?').get(login) as { id: string } | undefined
      const id = existing?.id ?? newId('t')
      db()
        .prepare(
          `INSERT INTO teachers (id, full_name, login, password_hash, status, registered_at, phone, subjects, extra_subjects, branch_id, is_coordinator)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, phone = excluded.phone, subjects = excluded.subjects,
             extra_subjects = excluded.extra_subjects, branch_id = excluded.branch_id, is_coordinator = excluded.is_coordinator`,
        )
        .run(id, t.fullName, login, hash, today, t.phone, JSON.stringify(t.subjects), JSON.stringify(t.extraSubjects), bId, t.isCoordinator ? 1 : 0)
      accounts.push({ login, fullName: t.fullName })
    })

    const lessons = writeLessons(wb, errors)

    // Har filialga test direktori: direktor (bitta filial bo'lsa) yoki direktor1, direktor2 ...
    const directors: { login: string; branch: string }[] = []
    branchNames.forEach((name, i) => {
      const bId = branchId.get(norm(name))!
      if (db().prepare('SELECT 1 FROM directors WHERE branch_id = ?').get(bId)) return
      const login = branchNames.length === 1 ? 'direktor' : `direktor${i + 1}`
      if (db().prepare('SELECT 1 FROM directors WHERE login = ?').get(login)) return
      db()
        .prepare('INSERT INTO directors (id, full_name, login, password_hash, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(newId('d'), `${name} direktori`, login, hash, bId, today)
      directors.push({ login, branch: name })
    })
    return { branches: branchNames.length, teachers: accounts, lessons, directors }
  })
  return { ...result, errors }
}
