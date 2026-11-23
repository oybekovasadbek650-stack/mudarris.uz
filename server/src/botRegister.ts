// Bot suhbatining o'zida ro'yxatdan o'tish — xodimlar uchun YAGONA yo'l (Mini App ochilsa ham shu yerga qaytariladi).
// Qadamlar: 1) ism-familiya (matn) 2) telefon ("Raqamni ulashish" tugmasi yoki qo'lda yozish)
// 3) muassasa 4) filial 5) lavozim (o'qituvchi / mas'ul / filial direktori) 6) fan (bir nechta; direktorga so'ralmaydi)
// -> "Hammasi to'g'rimi?" (har birini alohida tuzatish) -> yuborish.
// O'qituvchi va mas'ulni filial direktori botda tasdiqlaydi (registerTelegramUser), direktorni — umumiy rahbariyat panelda (requestDirector).
// Kirishda va oxirida bannerlar (server/assets/*.png). Holat tg_reg_sessions jadvalida — server qayta ishga tushsa ham davom etadi.
import { fileURLToPath } from 'node:url'
import { InlineKeyboard, InputFile, type Api, type Bot, type Context } from 'grammy'
import { db } from './db.ts'
import { config } from './config.ts'
import { HttpError, listBranches } from './repo.ts'
import {
  branchSubjects,
  formatPhone,
  nameError,
  parsePhone,
  phoneBelongsToExisting,
  PHONE_HINT,
  registerTelegramUser,
  requestDirector,
  saveContact,
} from './tgRegister.ts'
import type { Org } from '../../src/types.ts'

type Step = 'name' | 'phone' | 'org' | 'branch' | 'role' | 'subjects' | 'confirm'
type Role = 'teacher' | 'coordinator' | 'director'
interface Session {
  step: Step
  fullName?: string
  phone?: string
  verified?: boolean
  org?: Org
  branchId?: string
  role?: Role
  subjects?: string[]
  /** "Tuzatish" bosilgan: qadam tugagach to'g'ridan-to'g'ri tekshirish oynasiga qaytiladi */
  fix?: boolean
}

const ORG_NAMES: Record<Org, string> = { school: 'Maktab', academy: 'Akademiya', kindergarten: "Bog'cha" }
const ORG_ORDER: Org[] = ['school', 'academy', 'kindergarten']
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const firstName = (s: Session) => (s.fullName ?? '').split(' ')[0] ?? ''
const STEPS = 6
/** Qadam ko'rsatkichi: ▰▰▱▱▱▱ */
const bar = (n: number) => `${'▰'.repeat(n)}${'▱'.repeat(STEPS - n)}`
const head = (n: number, title: string) => `<b>${n}/${STEPS} · ${title}</b>\n${bar(n)}`

/** Lavozim nomlari (bog'chada "o'qituvchi" o'rniga "Tarbiyachi / xodim") */
function roleLabel(role: Role, org?: Org) {
  if (role === 'director') return 'Filial direktori'
  if (role === 'coordinator') return "Mas'ul shaxs"
  return org === 'kindergarten' ? 'Tarbiyachi / xodim' : org === 'academy' ? 'Ustoz' : "O'qituvchi"
}

// ---------- Bannerlar (birinchi yuborishdan keyin Telegram file_id qayta ishlatiladi) ----------
const fileIds = new Map<string, string>()
export async function sendBanner(api: Api, chatId: number, name: 'welcome' | 'done' | 'approved', caption: string, kb?: InlineKeyboard) {
  const cached = fileIds.get(name)
  const photo = cached ?? new InputFile(fileURLToPath(new URL(`../assets/${name}.png`, import.meta.url)))
  const m = await api.sendPhoto(chatId, photo, { caption, parse_mode: 'HTML', reply_markup: kb })
  const id = m.photo?.at(-1)?.file_id
  if (id) fileIds.set(name, id)
}

// ---------- Holat ----------
function load(id: number): Session | null {
  const r = db().prepare('SELECT data FROM tg_reg_sessions WHERE telegram_id = ?').get(id) as { data: string } | undefined
  return r ? (JSON.parse(r.data) as Session) : null
}
function save(id: number, s: Session) {
  db()
    .prepare('INSERT INTO tg_reg_sessions (telegram_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .run(id, JSON.stringify(s), new Date().toISOString())
}
const drop = (id: number) => db().prepare('DELETE FROM tg_reg_sessions WHERE telegram_id = ?').run(id)
export const dropRegistrationSession = drop
const isActiveTeacher = (id: number) => Boolean(db().prepare("SELECT 1 FROM teachers WHERE telegram_id = ? AND status = 'active'").get(id))
/** Ochiq suhbat — lekin hisob allaqachon faol bo'lsa (boshqa yo'l bilan ulangan), suhbat yopiladi */
function activeSession(id: number): Session | null {
  const s = load(id)
  if (s && isActiveTeacher(id)) {
    drop(id)
    return null
  }
  return s
}

const phoneKeyboard = {
  keyboard: [[{ text: 'Raqamni ulashish', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
  input_field_placeholder: '+998 90 123 45 67',
}

// ---------- Qadamlar matni ----------
const NAME_TEXT =
  `${head(1, 'Ismingiz va familiyangiz')}\n\n` +
  'Hujjatdagidek, <b>bitta xabarda</b> yozing — direktor sizni shu orqali taniydi.\n' +
  '<i>Masalan: Aziza Karimova</i>'

const phoneText = (s: Session) =>
  `Tanishganimdan xursandman, <b>${esc(firstName(s))}</b>!\n\n` +
  `${head(2, 'Telefon raqamingiz')}\n\n` +
  "Eng oson yo'li — pastdagi <b>«Raqamni ulashish»</b> tugmasi.\n" +
  'Yoki raqamni o\'zingiz yozing: <i>+998 90 123 45 67</i>'

function orgView() {
  const branches = listBranches()
  const kb = new InlineKeyboard()
  for (const org of ORG_ORDER) {
    const n = branches.filter((b) => b.org === org).length
    if (n) kb.text(`${ORG_NAMES[org]}  ·  ${n} ta filial`, `rg:org:${org}`).row()
  }
  return { text: `${head(3, 'Qayerda ishlaysiz?')}\n\nMuassasa turini tanlang:`, kb }
}

function branchView(org: Org) {
  const kb = new InlineKeyboard()
  for (const b of listBranches().filter((x) => x.org === org)) kb.text(clean(b.name), `rg:br:${b.id}`).row()
  kb.text('‹ Orqaga', 'rg:back:org')
  return { text: `${head(4, 'Qaysi filialda?')}\n\n<b>${ORG_NAMES[org]}</b> filiallari:`, kb }
}

function subjectsView(s: Session) {
  const list = branchSubjects(s.branchId!)
  const chosen = new Set(s.subjects ?? [])
  const kb = new InlineKeyboard()
  list.items.forEach((item, i) => {
    kb.text(chosen.has(item) ? `✓ ${item}` : item, `rg:s:${i}`)
    if (i % 2 === 1) kb.row()
  })
  kb.row().text('‹ Orqaga', 'rg:back:role').text(chosen.size ? `Tayyor (${chosen.size}) ›` : 'Tayyor ›', 'rg:done')
  const pos = list.kind === 'position'
  const picked = chosen.size ? `\n\nTanlandi: <b>${esc([...chosen].join(', '))}</b>` : ''
  return {
    text:
      `${head(6, pos ? 'Qaysi ish bilan shug\'ullanasiz?' : 'Qaysi fandan dars berasiz?')}\n\n` +
      `Bosib belgilang — <b>bir nechtasini</b> tanlash mumkin, keyin <b>«Tayyor»</b>.${picked}`,
    kb,
  }
}

/** 5-qadam: lavozim */
function roleView(s: Session) {
  const kb = new InlineKeyboard()
  for (const r of ['teacher', 'coordinator', 'director'] as Role[]) {
    kb.text(s.role === r ? `✓ ${roleLabel(r, s.org)}` : roleLabel(r, s.org), `rg:role:${r}`).row()
  }
  kb.text('‹ Orqaga', 'rg:back:br')
  return {
    text:
      `${head(5, 'Lavozimingiz?')}\n\n` +
      `<b>${roleLabel('teacher', s.org)}</b> — dars beradi, o'rinbosar takliflarini oladi.\n` +
      "<b>Mas'ul shaxs</b> — bundan tashqari o'rinbosarni tasdiqlay oladi.\n" +
      '<b>Filial direktori</b> — filialni boshqaradi (umumiy rahbariyat tasdiqlaydi).',
    kb,
  }
}

function confirmView(s: Session) {
  const branch = listBranches().find((b) => b.id === s.branchId)
  const isDirector = s.role === 'director'
  const pos = !isDirector && branchSubjects(s.branchId!).kind === 'position'
  const text =
    "<b>Hammasi to'g'rimi?</b>\n\n" +
    `<b>Ism:</b> ${esc(s.fullName ?? '')}\n` +
    `<b>Telefon:</b> ${esc(s.phone ?? '')}${s.verified ? '  ✓' : ''}\n` +
    `<b>Muassasa:</b> ${ORG_NAMES[s.org!]}\n` +
    `<b>Filial:</b> ${esc(clean(branch?.name ?? ''))}\n` +
    `<b>Lavozim:</b> ${roleLabel(s.role ?? 'teacher', s.org)}\n` +
    (isDirector ? '' : `<b>${pos ? 'Ish' : 'Fan'}:</b> ${esc((s.subjects ?? []).join(', '))}\n`) +
    "\nXato bo'lsa — kerakli qismni tuzating."
  const kb = new InlineKeyboard()
    .text('Ha, yuborish', 'rg:send')
    .row()
    .text('Ismni tuzatish', 'rg:fix:name')
    .text('Telefonni tuzatish', 'rg:fix:phone')
    .row()
    .text('Filialni tuzatish', 'rg:fix:org')
    .text('Lavozimni tuzatish', 'rg:fix:role')
  if (!isDirector) kb.row().text(pos ? 'Ishni tuzatish' : 'Fanni tuzatish', 'rg:fix:subjects')
  return { text, kb }
}

// ---------- Boshlash ----------
/** Ro'yxatni boshlaydi: banner + 1-savol. /start, /royxat va Mini App'dan "chatda ro'yxatdan o'tish" chaqiradi */
export async function beginRegistration(api: Api, chatId: number) {
  save(chatId, { step: 'name' })
  await sendBanner(
    api,
    chatId,
    'welcome',
    "<b>Assalomu alaykum! Mudarris o'rinbosar tizimiga xush kelibsiz.</b>\n\n" +
      "Darsga kela olmay qolsangiz — o'rningizga mos ustoz bir necha daqiqada topiladi. " +
      "Boshqa ustoz o'rniga kirish taklifi ham shu chatga keladi.\n\n" +
      `Ro'yxatdan o'tish — <b>${STEPS} ta oddiy savol</b>, taxminan 1 daqiqa.`,
  ).catch(() => api.sendMessage(chatId, `<b>Assalomu alaykum!</b> Ro'yxatdan o'tish — ${STEPS} ta oddiy savol.`, { parse_mode: 'HTML' }))
  await api.sendMessage(chatId, NAME_TEXT, { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } })
}
export const startRegistration = (ctx: Context) => beginRegistration(ctx.api, ctx.chat!.id)

async function askPhone(ctx: Context, s: Session) {
  await ctx.reply(phoneText(s), { parse_mode: 'HTML', reply_markup: phoneKeyboard })
}
async function showConfirm(ctx: Context, s: Session) {
  s.step = 'confirm'
  s.fix = false
  save(ctx.from!.id, s)
  const v = confirmView(s)
  await ctx.reply(v.text, { parse_mode: 'HTML', reply_markup: v.kb })
}

/** Telefon qabul qilingach — muassasa tanlovi (yoki tuzatishdan keyin tekshirishga) */
async function afterPhone(ctx: Context, s: Session) {
  await ctx.reply(`${s.verified ? 'Raqam tasdiqlandi' : 'Raqam qabul qilindi'}: <b>${esc(s.phone!)}</b>`, {
    parse_mode: 'HTML',
    reply_markup: { remove_keyboard: true },
  })
  if (s.fix) return showConfirm(ctx, s)
  s.step = 'org'
  save(ctx.from!.id, s)
  const v = orgView()
  await ctx.reply(v.text, { parse_mode: 'HTML', reply_markup: v.kb })
}

export function setupRegistration(bot: Bot) {
  // Telegram kontakti: ro'yxat suhbatida — telefon qadami
  bot.on('message:contact', async (ctx) => {
    const contact = ctx.message.contact
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply("Bu boshqa odamning raqami. Pastdagi «Raqamni ulashish» tugmasi orqali <b>o'zingiznikini</b> yuboring.", {
        parse_mode: 'HTML',
        reply_markup: phoneKeyboard,
      })
      return
    }
    saveContact(ctx.from.id, contact.phone_number)
    const s = activeSession(ctx.from.id)
    if (s?.step === 'phone') {
      s.phone = formatPhone(contact.phone_number)
      s.verified = true
      await afterPhone(ctx, s)
      return
    }
    await ctx.reply('Raqamingiz saqlandi.', { reply_markup: { remove_keyboard: true } })
  })

  // Matnli javoblar (ism, telefon). Buyruqlar (/start, /parol ...) bundan oldin ushlanadi.
  bot.on('message:text', async (ctx, next) => {
    const s = activeSession(ctx.from.id)
    if (!s) return next()
    const text = ctx.message.text.trim()
    if (s.step === 'name') {
      const err = nameError(text)
      if (err) {
        await ctx.reply(err)
        return
      }
      s.fullName = clean(text)
      if (s.fix) return showConfirm(ctx, s)
      s.step = 'phone'
      save(ctx.from.id, s)
      await askPhone(ctx, s)
      return
    }
    if (s.step === 'phone') {
      const phone = parsePhone(text)
      if (!phone) {
        await ctx.reply(`${PHONE_HINT}\nYoki pastdagi «Raqamni ulashish» tugmasini bosing.`, { reply_markup: phoneKeyboard })
        return
      }
      if (phoneBelongsToExisting(phone)) {
        await ctx.reply('Bu raqam bazada bor. Hisobingizga ulanish uchun pastdagi <b>«Raqamni ulashish»</b> tugmasini bosing.', {
          parse_mode: 'HTML',
          reply_markup: phoneKeyboard,
        })
        return
      }
      s.phone = phone
      s.verified = false
      await afterPhone(ctx, s)
      return
    }
    await ctx.reply('Yuqoridagi tugmalardan birini bosing.')
  })

  bot.callbackQuery(/^rg:(.+)$/, async (ctx) => {
    const id = ctx.from.id
    const [action, arg] = ctx.match![1].split(/:(.*)/s)
    const edit = (text: string, kb?: InlineKeyboard) => ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {})
    const s = activeSession(id)
    if (!s) {
      await ctx.answerCallbackQuery({ text: "Ro'yxat eskirgan. /start bosing.", show_alert: true })
      return
    }

    if (action === 'org' && (s.step === 'org' || s.step === 'branch')) {
      if (s.org !== arg) {
        s.subjects = []
        s.branchId = undefined
      }
      s.org = arg as Org
      s.step = 'branch'
      save(id, s)
      const v = branchView(s.org)
      await ctx.answerCallbackQuery({ text: ORG_NAMES[s.org] })
      await edit(v.text, v.kb)
      return
    }
    if (action === 'back' && arg === 'org' && s.step === 'branch') {
      s.step = 'org'
      save(id, s)
      const v = orgView()
      await ctx.answerCallbackQuery()
      await edit(v.text, v.kb)
      return
    }
    if (action === 'br' && s.step === 'branch') {
      if (!listBranches().some((b) => b.id === arg && b.org === s.org)) return ctx.answerCallbackQuery({ text: 'Filial topilmadi', show_alert: true })
      if (s.branchId !== arg) {
        // Boshqa filialda fanlar ro'yxati boshqacha bo'lishi mumkin — faqat mavjudlari qoladi
        const allowed = new Set(branchSubjects(arg).items)
        s.subjects = (s.subjects ?? []).filter((x) => allowed.has(x))
      }
      s.branchId = arg
      s.step = 'role'
      save(id, s)
      const v = roleView(s)
      await ctx.answerCallbackQuery()
      await edit(v.text, v.kb)
      return
    }
    if (action === 'back' && arg === 'br' && s.step === 'role') {
      s.step = 'branch'
      save(id, s)
      const v = branchView(s.org!)
      await ctx.answerCallbackQuery()
      await edit(v.text, v.kb)
      return
    }
    if (action === 'role' && s.step === 'role' && ['teacher', 'coordinator', 'director'].includes(arg)) {
      s.role = arg as Role
      await ctx.answerCallbackQuery({ text: roleLabel(s.role, s.org) })
      // Direktorga fan so'ralmaydi — to'g'ridan-to'g'ri tekshirish
      if (s.role === 'director' || (s.fix && s.subjects?.length)) {
        s.step = 'confirm'
        s.fix = false
        save(id, s)
        const v = confirmView(s)
        await edit(v.text, v.kb)
        return
      }
      s.step = 'subjects'
      save(id, s)
      const v = subjectsView(s)
      await edit(v.text, v.kb)
      return
    }
    if (action === 'back' && arg === 'role' && s.step === 'subjects') {
      s.step = 'role'
      save(id, s)
      const v = roleView(s)
      await ctx.answerCallbackQuery()
      await edit(v.text, v.kb)
      return
    }
    if (action === 's' && s.step === 'subjects') {
      const item = branchSubjects(s.branchId!).items[Number(arg)]
      if (!item) return ctx.answerCallbackQuery()
      const set = new Set(s.subjects ?? [])
      if (set.has(item)) set.delete(item)
      else set.add(item)
      s.subjects = [...set]
      save(id, s)
      const v = subjectsView(s)
      await ctx.answerCallbackQuery({ text: set.has(item) ? `${item} — tanlandi` : `${item} — olib tashlandi` })
      await edit(v.text, v.kb)
      return
    }
    if (action === 'done' && s.step === 'subjects') {
      if (!s.subjects?.length) return ctx.answerCallbackQuery({ text: 'Kamida bittasini belgilang', show_alert: true })
      s.step = 'confirm'
      s.fix = false
      save(id, s)
      const v = confirmView(s)
      await ctx.answerCallbackQuery()
      await edit(v.text, v.kb)
      return
    }
    if (action === 'fix' && s.step === 'confirm') {
      await ctx.answerCallbackQuery()
      await ctx.editMessageReplyMarkup().catch(() => {})
      s.fix = true
      if (arg === 'name') {
        s.step = 'name'
        save(id, s)
        await ctx.reply('Ism va familiyangizni qaytadan yozing:\n<i>Masalan: Aziza Karimova</i>', { parse_mode: 'HTML' })
      } else if (arg === 'phone') {
        s.step = 'phone'
        save(id, s)
        await askPhone(ctx, s)
      } else if (arg === 'org') {
        s.step = 'org'
        save(id, s)
        const v = orgView()
        await ctx.reply(v.text, { parse_mode: 'HTML', reply_markup: v.kb })
      } else if (arg === 'role') {
        s.step = 'role'
        save(id, s)
        const v = roleView(s)
        await ctx.reply(v.text, { parse_mode: 'HTML', reply_markup: v.kb })
      } else {
        s.step = 'subjects'
        save(id, s)
        const v = subjectsView(s)
        await ctx.reply(v.text, { parse_mode: 'HTML', reply_markup: v.kb })
      }
      return
    }
    if (action === 'send' && s.step === 'confirm' && s.role === 'director') {
      try {
        requestDirector({ telegramId: id, fullName: s.fullName!, phone: s.phone!, branchId: s.branchId! })
        drop(id)
        await ctx.answerCallbackQuery({ text: 'Yuborildi' })
        await edit(`${confirmView(s).text.replace(/\n\nXato bo'lsa.*$/s, '')}\n\n<b>Yuborildi.</b>`)
        const branch = clean(listBranches().find((b) => b.id === s.branchId)?.name ?? '')
        await sendBanner(
          ctx.api,
          id,
          'done',
          `<b>Rahmat, ${esc(firstName(s))}!</b> <b>${esc(branch)}</b> direktorligi uchun arizangiz <b>umumiy rahbariyatga</b> yuborildi.\n\n` +
            'Tasdiqlanishi bilan panelga kirish uchun login va parol shu chatga keladi.\n\n' +
            '<b>Direktor sifatida:</b>\n' +
            "› Yangi xodimlar arizasini shu chatda tasdiqlaysiz\n" +
            "› O'rinbosar topilganda «Tasdiqlash» tugmasi sizga keladi",
        )
      } catch (e) {
        await ctx.answerCallbackQuery({ text: e instanceof HttpError ? e.message : 'Xato yuz berdi', show_alert: true })
      }
      return
    }
    if (action === 'send' && s.step === 'confirm') {
      try {
        const r = await registerTelegramUser({
          coordinator: s.role === 'coordinator',
          telegramId: id,
          fullName: s.fullName!,
          phone: s.phone!,
          phoneVerified: Boolean(s.verified),
          branchId: s.branchId!,
          subjects: s.subjects ?? [],
        })
        drop(id)
        await ctx.answerCallbackQuery({ text: 'Yuborildi' })
        await edit(`${confirmView(s).text.replace(/\n\nXato bo'lsa.*$/s, '')}\n\n<b>Yuborildi.</b>`)
        const branch = clean(listBranches().find((b) => b.id === s.branchId)?.name ?? '')
        if (r.status === 'active') {
          // Davomatdan oldin kiritilgan faol xodim — raqam bo'yicha ulandi
          await sendBanner(
            ctx.api,
            id,
            'approved',
            `<b>${esc(firstName(s))}, hisobingiz topildi va Telegram ulandi!</b>\n\nLogin: <code>${esc(r.login)}</code>\n` +
              "Endi o'rinbosar takliflari shu chatga keladi. Ilovani ochish — pastdagi <b>«Ilova»</b> tugmasi.",
          )
          await enableAppButton(ctx.api, id)
        } else {
          await sendBanner(
            ctx.api,
            id,
            'done',
            `<b>Rahmat, ${esc(firstName(s))}!</b> Arizangiz <b>${esc(branch)}</b> direktoriga yuborildi.\n\n` +
              `Loginingiz: <code>${esc(r.login)}</code>\n` +
              'Direktor tasdiqlashi bilan parolingiz va <b>«Ilova»</b> tugmasi shu chatga keladi.\n\n' +
              "<b>Keyin qanday ishlaydi?</b>\n" +
              "› Darsga kela olmasangiz — «Ilova» → «Kela olmayman»\n" +
              "› Boshqa ustoz o'rniga kirish taklifi kelsa — «Qabul qilaman» tugmasi",
          )
        }
      } catch (e) {
        const msg = e instanceof HttpError ? e.message : 'Xato yuz berdi'
        await ctx.answerCallbackQuery({ text: msg, show_alert: true })
        if (e instanceof HttpError && e.status === 409 && /raqam/i.test(msg)) {
          s.step = 'phone'
          s.fix = true
          save(id, s)
          await askPhone(ctx, s)
        }
      }
      return
    }
    await ctx.answerCallbackQuery()
  })
}

/** Shu chat uchun pastdagi "Ilova" menyu tugmasi (faqat tasdiqlangan xodimlarda; HTTPS manzil bo'lsa) */
export async function enableAppButton(api: Api, chatId: number) {
  const url = config.webAppUrl.replace(/\/$/, '')
  if (!url.startsWith('https://')) return
  await api.setChatMenuButton({ chat_id: chatId, menu_button: { type: 'web_app', text: 'Ilova', web_app: { url: `${url}/login` } } }).catch(() => {})
}
