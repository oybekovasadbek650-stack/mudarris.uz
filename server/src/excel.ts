// Excel faylni o'qish ("orinbosar_test_jadvali.xlsx" tuzilishi bo'yicha).
// Varaqlar: "Filial va qoidalar", "Qo'ng'iroqlar", "O'qituvchilar", "Dars jadvali", "Test ssenariylari".
// Varaq nomlari apostrof turlariga va katta-kichik harfga sezgir emas.
import ExcelJS from 'exceljs'

export interface ParsedTeacher {
  code: string // T1
  fullName: string
  phone: string
  branchName: string
  subjects: string[]
  extraSubjects: string[]
  isCoordinator: boolean
}
export interface ParsedLesson {
  weekday: number
  para: number
  className: string
  subject: string
  teacherName: string
  room: string
  row: number
}
export interface ParsedScenario {
  no: number
  weekday: number
  teacherName: string
  para: number
  className: string
  subject: string
  expected: string
}
export interface ParsedWorkbook {
  rules: Record<string, string>
  bells: { para: number; start: string; end: string }[]
  teachers: ParsedTeacher[]
  lessons: ParsedLesson[]
  scenarios: ParsedScenario[]
  errors: string[]
}

const WEEKDAYS: Record<string, number> = { dushanba: 1, seshanba: 2, chorshanba: 3, payshanba: 4, juma: 5, shanba: 6, yakshanba: 7 }

export const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, ' ').trim()

const list = (s: string) =>
  s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean)

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString()
    if ('richText' in v) return v.richText.map((r) => r.text).join('')
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue)
    if ('text' in v) return String(v.text)
  }
  return String(v).trim()
}

/** Excel vaqti: kun ulushi (0.354 = 08:30), Date yoki "08:30" matni -> "HH:MM" */
function cellTime(v: ExcelJS.CellValue): string {
  let minutes: number | undefined
  if (typeof v === 'number') minutes = Math.round(v * 24 * 60)
  else if (v instanceof Date) minutes = v.getUTCHours() * 60 + v.getUTCMinutes()
  else {
    const m = /^(\d{1,2})[:.](\d{2})/.exec(cellText(v))
    if (m) minutes = Number(m[1]) * 60 + Number(m[2])
  }
  if (minutes === undefined) return ''
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function rows(ws: ExcelJS.Worksheet | undefined): ExcelJS.CellValue[][] {
  if (!ws) return []
  const out: ExcelJS.CellValue[][] = []
  ws.eachRow((row) => {
    const vals = (row.values as ExcelJS.CellValue[]).slice(1) // exceljs 1-indeksli
    if (vals.some((v) => cellText(v) !== '')) out.push(vals)
  })
  return out
}

export async function parseWorkbook(data: ArrayBuffer | Buffer): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data as ArrayBuffer)
  const sheet = (name: string) => wb.worksheets.find((w) => norm(w.name) === norm(name))
  const errors: string[] = []

  const rules: Record<string, string> = {}
  for (const [k, v] of rows(sheet('Filial va qoidalar')).slice(1)) {
    if (cellText(k)) rules[norm(cellText(k))] = cellText(v)
  }

  const bells = rows(sheet("Qo'ng'iroqlar"))
    .slice(1)
    .map(([p, s, e]) => ({ para: Number(cellText(p)), start: cellTime(s), end: cellTime(e) }))
    .filter((b) => b.para > 0 && b.start && b.end)

  const teachers: ParsedTeacher[] = rows(sheet("O'qituvchilar"))
    .slice(1)
    .map(([code, name, phone, branch, subj, extra, role]) => ({
      code: cellText(code),
      fullName: cellText(name),
      phone: cellText(phone),
      branchName: cellText(branch),
      subjects: list(cellText(subj)),
      extraSubjects: list(cellText(extra)),
      isCoordinator: norm(cellText(role)).includes("mas'ul"),
    }))
    .filter((t) => t.fullName)

  const lessonSheet = sheet('Dars jadvali')
  if (!lessonSheet) errors.push('"Dars jadvali" varag\'i topilmadi')
  const lessons: ParsedLesson[] = []
  rows(lessonSheet)
    .slice(1)
    .forEach(([day, para, cls, subj, teacher, room], i) => {
      const row = i + 2
      const weekday = WEEKDAYS[norm(cellText(day))]
      const p = Number(cellText(para))
      if (!weekday) return errors.push(`${row}-qator: kun noto'g'ri ("${cellText(day)}")`)
      if (!(p >= 1 && p <= 12)) return errors.push(`${row}-qator: para noto'g'ri ("${cellText(para)}")`)
      if (!cellText(cls) || !cellText(subj) || !cellText(teacher)) return errors.push(`${row}-qator: sinf, fan yoki o'qituvchi bo'sh`)
      lessons.push({ weekday, para: p, className: cellText(cls), subject: cellText(subj), teacherName: cellText(teacher), room: cellText(room), row })
    })

  const scenarios: ParsedScenario[] = rows(sheet('Test ssenariylari'))
    .slice(1)
    .map(([no, day, teacher, para, cls, subj, expected]) => ({
      no: Number(cellText(no)),
      weekday: WEEKDAYS[norm(cellText(day))] ?? 0,
      teacherName: cellText(teacher),
      para: Number(cellText(para)),
      className: cellText(cls),
      subject: cellText(subj),
      expected: cellText(expected),
    }))
    .filter((s) => s.no > 0 && s.weekday > 0)

  return { rules, bells, teachers, lessons, scenarios, errors }
}

/** "Filial va qoidalar" varag'idan sozlamalar */
export function rulesToSettings(rules: Record<string, string>) {
  const get = (key: string) => Object.entries(rules).find(([k]) => k.includes(key))?.[1] ?? ''
  const limit = /(\d+)/.exec(get('kuniga'))
  const deadline = /(\d{1,2}):(\d{2})/.exec(get('muddati'))
  const pay = /(\d[\d\s]*)/.exec(get('haqi'))
  return {
    branchName: get('filial nomi') || 'Asosiy filial',
    dailyLimit: limit ? Number(limit[1]) : undefined,
    noticeDeadline: deadline ? `${deadline[1].padStart(2, '0')}:${deadline[2]}` : undefined,
    allowCrossBranch: get('boshqa filial') ? !norm(get('boshqa filial')).startsWith("yo'q") : undefined,
    paymentPerLesson: pay ? Number(pay[1].replace(/\s/g, '')) : 0,
  }
}
