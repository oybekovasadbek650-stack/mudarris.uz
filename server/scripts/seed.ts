// Bazani Excel fayldan to'ldirish: filial, qoidalar, qo'ng'iroqlar, o'qituvchilar, dars jadvali.
// Ishlatish: npm run seed -- [excel-fayl]   (standart: data/orinbosar_test_jadvali.xlsx)
// Qayta ishga tushirsa bo'ladi: o'qituvchilar yangilanadi, darslar almashtiriladi.
import { readFileSync } from 'node:fs'
import { config } from '../src/config.ts'
import { openDb } from '../src/db.ts'
import { parseWorkbook } from '../src/excel.ts'
import { seedFromWorkbook } from '../src/importer.ts'
import { getSettings } from '../src/repo.ts'

const file = process.argv[2] ?? 'data/orinbosar_test_jadvali.xlsx'
const password = process.env.SEED_PASSWORD ?? '123456'

openDb(config.dbPath)
const result = await seedFromWorkbook(await parseWorkbook(readFileSync(file)), password)

console.log(`Baza: ${config.dbPath}`)
console.log(`Filiallar: ${result.branches}, darslar: ${result.lessons}`)
console.log('Sozlamalar:', getSettings())
console.log(`O'qituvchilar (parol: ${password}):`)
for (const t of result.teachers) console.log(`  ${t.login.padEnd(10)} ${t.fullName}`)
if (result.directors.length) {
  console.log(`Direktorlar (parol: ${password}):`)
  for (const d of result.directors) console.log(`  ${d.login.padEnd(10)} ${d.branch}`)
}
if (result.errors.length) {
  console.log('Ogohlantirishlar:')
  result.errors.forEach((e) => console.log('  - ' + e))
}
