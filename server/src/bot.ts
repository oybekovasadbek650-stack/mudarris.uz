// Telegram bot (grammY). Vazifalari:
//  - /start: salomlashish; /start link_<kod> — Telegram akkauntni hisobga bog'lash (telegramLink.ts);
//  - ustozga taklif xabari: "Qabul qilaman" / "Rad etaman" tugmalari bilan (Mini App'ni ochmasdan javob berish);
//  - tasdiqlovchilarga (filial direktori + mas'ul o'qituvchilar): yangi ariza, nomzod rozi bo'ldi
//    ("Tasdiqlash" tugmasi bilan), o'rinbosar topilmadi, kim tasdiqladi;
//  - tanlangan ustozga va kelmaydigan ustozga: natija.
import { Bot, InlineKeyboard, GrammyError } from 'grammy'
import { db } from './db.ts'
import { config, runtime } from './config.ts'
import { setNotifier } from './notify.ts'
import { emitChange } from './events.ts'
import { absenceRow, caseRow, chooseCandidate, offerDeadline, offerRow, respondOffer, type Actor } from './logic.ts'
import { effectiveSettings } from './settings.ts'
import { approversOf, lessonsOn, teacherRow, type CaseRow } from './repo.ts'
import { openAbsenceForMissing, teacherAttendanceReply } from './attendance.ts'
import { consumeLinkCode } from './telegramLink.ts'
import { canDecide, decideTeacher, directorRequestRow, issuePassword } from './tgRegister.ts'
import { beginRegistration, dropRegistrationSession, enableAppButton, sendBanner, setupRegistration, startRegistration } from './botRegister.ts'
import { localNow } from './time.ts'
import { HttpError } from './repo.ts'
import type { Lesson } from '../../src/types.ts'

const WEEKDAYS = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function fmtDate(date: string, weekday: number) {
  const [, m, d] = date.split('-').map(Number)
  return `${d}-${MONTHS[m - 1]}, ${WEEKDAYS[weekday]}`
}
const lessonLine = (date: string, l: Lesson) =>
  `${fmtDate(date, l.weekday)}\n${l.para}-para (${l.startTime}–${l.endTime}) · ${esc(l.className)} · ${esc(l.subject)}${l.room ? ` · ${esc(l.room)}-xona` : ''}`

/** Mini App'ni kerakli sahifada ochadigan tugma */
function appButton(kb: InlineKeyboard, text: string, startapp: string) {
  if (config.miniAppLink) return kb.url(text, `${config.miniAppLink}?startapp=${startapp}`)
  if (config.webAppUrl) return kb.webApp(text, `${config.webAppUrl.replace(/\/$/, '')}/app?startapp=${startapp}`)
  return kb
}

/** Telegram'i bog'langan tasdiqlovchilar (bir odam ham direktor, ham mas'ul bo'lsa — bir marta) */
function approverChats(branchId: string, exceptActor?: { role: string; id: string }) {
  const seen = new Set<number>()
  return approversOf(branchId).filter((a) => {
    if (a.telegramId == null || seen.has(a.telegramId)) return false
    if (exceptActor && a.id === exceptActor.id) return false
    seen.add(a.telegramId)
    return true
  })
}

/** Telegram foydalanuvchisi qaysi rollarda tasdiqlay oladi (direktor birinchi) */
function actorsForTelegram(telegramId: number): Actor[] {
  const actors: Actor[] = []
  const d = db().prepare('SELECT id FROM directors WHERE telegram_id = ?').get(telegramId) as { id: string } | undefined
  if (d) actors.push({ role: 'director', id: d.id })
  const t = db()
    .prepare("SELECT id FROM teachers WHERE telegram_id = ? AND is_coordinator = 1 AND status = 'active'")
    .get(telegramId) as { id: string } | undefined
  if (t) actors.push({ role: 'teacher', id: t.id })
  return actors
}

/** Chat pastidagi "Ilova" menyu tugmasi (HTTPS manzil bo'lsa) va buyruqlar ro'yxati */
async function setupMenu(bot: Bot) {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Boshlash / ilovani ochish' },
    { command: 'royxat', description: "Ro'yxatdan o'tish" },
    { command: 'parol', description: 'Kompyuterdan kirish uchun yangi parol' },
  ])
  // Hammaga: buyruqlar menyusi (ro'yxat — chatning o'zida). "Ilova" tugmasi — faqat tasdiqlangan xodimlarga, chat bo'yicha
  await bot.api.setChatMenuButton({ menu_button: { type: 'commands' } })
  const rows = db().prepare("SELECT telegram_id FROM teachers WHERE telegram_id IS NOT NULL AND status = 'active'").all() as { telegram_id: number }[]
  for (const r of rows) {
    await enableAppButton(bot.api, r.telegram_id)
    await new Promise((res) => setTimeout(res, 60)) // Telegram cheklovi: sekundiga ~30 so'rov
  }
}

export function startBot() {
  if (!config.botToken) {
    console.log('BOT_TOKEN yo\'q — bot ishga tushirilmadi (API ishlayveradi)')
    return
  }
  const bot = new Bot(config.botToken)

  const send = async (chatId: number | null | undefined, text: string, kb?: InlineKeyboard) => {
    if (!chatId) return
    // Tugmasiz klaviatura yuborilmaydi (Mini App manzili berilmagan bo'lsa)
    const markup = kb && kb.inline_keyboard.some((row) => row.length > 0) ? kb : undefined
    try {
      await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: markup })
    } catch (e) {
      console.error(`Telegram xabar yuborilmadi (${chatId}):`, e instanceof GrammyError ? e.description : e)
    }
  }
  const run = (fn: () => Promise<void>) => () => void fn().catch((e) => console.error('Bot xabari xatosi:', e))
  const lessonOf = (c: CaseRow) => JSON.parse(c.lesson_json) as Lesson

  setNotifier({
    absenceCreated: (absenceId) =>
      run(async () => {
        const a = absenceRow(absenceId)!
        const t = teacherRow(a.teacher_id)!
        const cases = db().prepare('SELECT * FROM cases WHERE absence_id = ?').all(absenceId) as unknown as CaseRow[]
        const paras = cases.map((c) => lessonOf(c).para).sort((x, y) => x - y).join(', ')
        const late = a.late ? '\n\n<b>Kech xabar berildi</b> (belgilangan muddatdan keyin)' : ''
        const weekday = cases[0] ? lessonOf(cases[0]).weekday : 0
        const text = `<b>Yangi ariza: kela olmaydi</b>\n${esc(t.full_name)}\n${fmtDate(a.date, weekday)} · ${paras}-${cases.length > 1 ? 'paralar' : 'para'}\nSabab: ${esc(a.reason)}${late}`
        for (const a of approverChats(t.branch_id)) await send(a.telegramId, text, appButton(new InlineKeyboard(), 'Holatlarni ochish', 'cases'))
      })(),

    offerCreated: (offerId) =>
      run(async () => {
        const o = offerRow(offerId)!
        const c = caseRow(o.case_id)!
        const t = teacherRow(o.teacher_id)!
        const absent = teacherRow(absenceRow(c.absence_id)!.teacher_id)!
        const kb = new InlineKeyboard().text('Qabul qilaman', `offer:y:${o.id}`).text('Rad etaman', `offer:n:${o.id}`)
        if (config.miniAppLink || config.webAppUrl) appButton(kb.row(), 'Ilovada ochish', 'offers')
        const deadline = offerDeadline(o)
        const others = (
          db().prepare("SELECT COUNT(*) n FROM offers WHERE case_id = ? AND status IN ('pending', 'accepted') AND id != ?").get(c.id, o.id) as { n: number }
        ).n
        const until =
          (deadline ? `\n\nJavob berish muddati: <b>${localNow(deadline).time} gacha</b>.` : '') +
          (others > 0 ? `\nTaklif yana ${others} ta ustozga yuborilgan — birinchi rozi bo'lganlar direktorga tasdiqlash uchun ko'rsatiladi.` : '')
        await send(
          t.telegram_id,
          `<b>O'rinbosar kerak</b>\n${esc(absent.full_name)} o'rniga darsga kira olasizmi?\n\n${lessonLine(c.date, lessonOf(c))}${until}`,
          kb,
        )
      })(),

    offerExpired: (offerId) =>
      run(async () => {
        const o = offerRow(offerId)!
        const c = caseRow(o.case_id)!
        await send(
          teacherRow(o.teacher_id)?.telegram_id,
          `<b>Taklif yopildi</b>\nJavob berish muddati o'tdi.\n\n${lessonLine(c.date, lessonOf(c))}`,
        )
      })(),

    offerAccepted: (offerId) =>
      run(async () => {
        const o = offerRow(offerId)!
        const c = caseRow(o.case_id)!
        const l = lessonOf(c)
        const t = teacherRow(o.teacher_id)!
        for (const a of approverChats(l.branchId)) {
          const kb = new InlineKeyboard().text(`Tasdiqlash: ${t.full_name}`.slice(0, 60), `ch:${c.id}:${t.id}`)
          if (config.miniAppLink || config.webAppUrl) appButton(kb.row(), 'Batafsil', `case_${c.id}`)
          await send(
            a.telegramId,
            `<b>Nomzod rozi bo'ldi</b>\n${esc(t.full_name)} o'rinbosar bo'lishga tayyor.\n\n${lessonLine(c.date, l)}\n\nTasdiqlasangiz, darsga u kiradi. Direktor yoki mas'uldan birining tasdig'i yetarli.`,
            kb,
          )
        }
      })(),

    caseNotFound: (caseId) =>
      run(async () => {
        const c = caseRow(caseId)!
        const l = lessonOf(c)
        const absent = teacherRow(absenceRow(c.absence_id)!.teacher_id)!
        for (const a of approverChats(l.branchId)) {
          await send(
            a.telegramId,
            `<b>O'rinbosar topilmadi</b>\n${esc(absent.full_name)} o'rniga mos ustoz yo'q.\n\n${lessonLine(c.date, l)}\n\nMasalani qo'lda hal qiling.`,
            appButton(new InlineKeyboard(), 'Batafsil', `case_${c.id}`),
          )
        }
        await send(absent.telegram_id, `<b>O'rinbosar topilmadi</b>\nMas'ul shaxsga xabar berildi, masala qo'lda hal qilinadi.\n\n${lessonLine(c.date, l)}`)
      })(),

    attendanceAsk: (teacherId, date) =>
      run(async () => {
        const t = teacherRow(teacherId)!
        const first = lessonsOn(teacherId, date)[0]
        if (!first) return
        const kb = new InlineKeyboard().text('Kelyapman', `at:y:${date}`).text('Kela olmayman', `at:n:${date}`)
        await send(
          t.telegram_id,
          `<b>Bugun darsingiz bor</b>\n${lessonLine(date, first)}\n\nDavomatda kirishingiz hali ko'rinmayapti. Kelyapsizmi?\n` +
            `<i>Javob bo'lmasa, ${effectiveSettings(t.branch_id).attendanceEscalateMinutes} daqiqadan keyin direktor va mas'ulga xabar beriladi.</i>`,
          kb,
        )
      })(),

    attendanceEscalate: (teacherId, date, reason) =>
      run(async () => {
        const t = teacherRow(teacherId)!
        const first = lessonsOn(teacherId, date)[0]
        if (!first) return
        const why = reason === 'no_telegram' ? "Ustozning Telegram'i ulanmagan — so'rab bo'lmadi." : 'Botdagi savolga javob bermadi.'
        for (const a of approverChats(t.branch_id)) {
          await send(
            a.telegramId,
            `<b>Ustoz hali kelmadi</b>\n${esc(t.full_name)} — davomatda kirish yo'q.\n${why}\n\nBirinchi darsi:\n${lessonLine(date, first)}\n\n` +
              "Kelmasligi aniq bo'lsa, o'rinbosar qidirishni boshlang.",
            new InlineKeyboard().text("O'rinbosar qidirish", `ax:${teacherId}:${date}`),
          )
        }
      })(),

    attendanceComing: (teacherId, date) =>
      run(async () => {
        const t = teacherRow(teacherId)!
        for (const a of approverChats(t.branch_id)) {
          await send(a.telegramId, `<b>${esc(t.full_name)}</b> javob berdi: kelyapman.\n(${fmtDate(date, lessonsOn(teacherId, date)[0]?.weekday ?? 0)})`)
        }
      })(),

    caseChosen: (caseId, expiredOfferIds, actor) =>
      run(async () => {
        const c = caseRow(caseId)!
        const l = lessonOf(c)
        const chosen = teacherRow(c.chosen_teacher_id!)!
        // Boshqa tasdiqlovchilarga: masala hal bo'ldi, qayta tasdiqlash shart emas
        for (const a of approverChats(l.branchId, actor)) {
          await send(
            a.telegramId,
            `<b>O'rinbosar tasdiqlandi</b>\nDarsga ${esc(chosen.full_name)} kiradi.\nTasdiqladi: ${esc(c.chosen_by ?? '')}\n\n${lessonLine(c.date, l)}`,
          )
        }
        await send(
          chosen.telegram_id,
          `<b>Siz o'rinbosar etib tayinlandingiz</b>\n\n${lessonLine(c.date, l)}`,
          appButton(new InlineKeyboard(), "O'rinbosar darslarim", 'substitutions'),
        )
        // Kelmaydigan ustozga: o'rningizga kim kiradi
        const absent = teacherRow(absenceRow(c.absence_id)!.teacher_id)
        await send(absent?.telegram_id, `<b>O'rinbosar topildi</b>\nO'rningizga ${esc(chosen.full_name)} kiradi.\n\n${lessonLine(c.date, l)}`)
        for (const id of expiredOfferIds) {
          const o = offerRow(id)
          if (o) await send(teacherRow(o.teacher_id)?.telegram_id, `Bu dars uchun boshqa ustoz tanlandi, rahmat.\n\n${lessonLine(c.date, l)}`)
        }
      })(),

    teacherRegistered: (teacherId) =>
      run(async () => {
        const t = teacherRow(teacherId)!
        const branch = db().prepare('SELECT name FROM branches WHERE id = ?').get(t.branch_id) as { name: string } | undefined
        const subjects = (JSON.parse(t.subjects) as string[]).join(', ')
        const kb = new InlineKeyboard().text('Tasdiqlash', `reg:y:${t.id}`).text('Rad etish', `reg:n:${t.id}`)
        for (const a of approverChats(t.branch_id)) {
          await send(
            a.telegramId,
            `<b>Yangi xodim ro'yxatdan o'tdi</b>\n\n<b>Ism:</b> ${esc(t.full_name)}\n<b>Telefon:</b> ${esc(t.phone)}\n<b>Filial:</b> ${esc((branch?.name ?? '').replace(/\s+/g, ' '))}\n` +
              `<b>Lavozim:</b> ${t.is_coordinator ? "Mas'ul shaxs (o'rinbosarni tasdiqlay oladi)" : "O'qituvchi"}\n<b>Fan:</b> ${esc(subjects)}\n\n` +
              "Tasdiqlasangiz, unga o'rinbosar takliflari kela boshlaydi.",
            kb,
          )
        }
        // Xodimning o'ziga "Ariza yuborildi" banneri suhbatning o'zida (botRegister.ts) yuboriladi
      })(),

    registrationRequested: (telegramId) => run(() => beginRegistration(bot.api, telegramId))(),

    // Umumiy rahbariyatda Telegram yo'q — ariza panelda ko'rinadi (jonli yangilanish orqali)
    directorRequested: () => {},

    directorDecided: (requestId, approved, creds) =>
      run(async () => {
        const r = directorRequestRow(requestId)
        if (!r) return
        const branch = (db().prepare('SELECT name FROM branches WHERE id = ?').get(r.branch_id) as { name: string } | undefined)?.name.replace(/\s+/g, ' ') ?? ''
        const first = esc(r.full_name.split(' ')[0] ?? '')
        if (!approved) {
          await send(r.telegram_id, `<b>Direktorlik arizangiz rad etildi</b>\n${esc(branch)}\n\nSavollar bo'lsa, umumiy rahbariyatga murojaat qiling.`)
          return
        }
        const panel = config.webAppUrl.startsWith('https://') ? `\nPanel: ${config.webAppUrl.replace(/\/$/, '')}/admin/login` : ''
        await sendBanner(
          bot.api,
          r.telegram_id,
          'approved',
          `<b>Tabriklaymiz, ${first}! Siz ${esc(branch)} direktori etib tayinlandingiz.</b>\n\n` +
            "› Yangi xodimlar arizasi va o'rinbosar tasdiqlash so'rovlari shu chatga keladi\n" +
            '› Panelda faqat o\'z filialingizni ko\'rasiz' +
            (creds ? `\n\n<b>Panelga kirish:</b>\nLogin: <code>${esc(creds.login)}</code>\nParol: <code>${creds.password}</code>${panel}` : ''),
        ).catch((e) => console.error('Banner yuborilmadi:', e instanceof GrammyError ? e.description : e))
      })(),

    teacherDecided: (teacherId, status) =>
      run(async () => {
        const t = teacherRow(teacherId)!
        if (status === 'rejected') {
          await send(t.telegram_id, "<b>Arizangiz rad etildi</b>\nSavollar bo'lsa, filial direktoriga murojaat qiling.")
          return
        }
        if (!t.telegram_id) return
        // Bot orqali ro'yxatdan o'tganga parol shu yerda yaratiladi (kompyuterdan kirish uchun)
        const password = t.password_pending ? await issuePassword(t.id) : null
        const first = esc(t.full_name.split(' ')[0] ?? '')
        const caption =
          `<b>Tabriklaymiz, ${first}! Hisobingiz tasdiqlandi.</b>\n\n` +
          "Endi o'rinbosar takliflari shu chatga keladi.\n" +
          "› Kela olmasangiz — pastdagi <b>«Ilova»</b> → «Kela olmayman»\n" +
          "› Taklif kelsa — xabardagi «Qabul qilaman» tugmasi" +
          (password
            ? `\n\n<b>Kompyuterdan saytga kirish uchun:</b>\nLogin: <code>${esc(t.login)}</code>\nParol: <code>${password}</code>\n<i>Telegram ichida parol kerak emas. Unutsangiz — /parol</i>`
            : '')
        const kb = appButton(new InlineKeyboard(), 'Ilovani ochish', 'today')
        await sendBanner(bot.api, t.telegram_id, 'approved', caption, kb.inline_keyboard.some((r) => r.length) ? kb : undefined).catch((e) =>
          console.error('Banner yuborilmadi:', e instanceof GrammyError ? e.description : e),
        )
        await enableAppButton(bot.api, t.telegram_id)
      })(),
  })

  // Direktor yoki mas'ul yangi xodimni botdan tasdiqlaydi / rad etadi
  bot.callbackQuery(/^reg:([yn]):(.+)$/, async (ctx) => {
    const [, answer, teacherId] = ctx.match!
    if (!canDecide(ctx.from.id, teacherId)) return ctx.answerCallbackQuery({ text: "Sizda bu huquq yo'q", show_alert: true })
    const t = teacherRow(teacherId)
    if (!t) return ctx.answerCallbackQuery({ text: 'Xodim topilmadi', show_alert: true })
    if (t.status !== 'pending') {
      await ctx.answerCallbackQuery({ text: t.status === 'active' ? 'Allaqachon tasdiqlangan' : 'Allaqachon rad etilgan' })
      return
    }
    decideTeacher(teacherId, answer === 'y' ? 'active' : 'rejected')
    await ctx.answerCallbackQuery({ text: answer === 'y' ? 'Tasdiqlandi' : 'Rad etildi' })
    const note = answer === 'y' ? '\n\n<b>Siz tasdiqladingiz.</b>' : '\n\n<b>Siz rad etdingiz.</b>'
    await ctx.editMessageText(esc(ctx.callbackQuery.message?.text ?? '') + note, { parse_mode: 'HTML' }).catch(() => {})
  })

  // Kompyuterdan kirish uchun yangi parol
  bot.command('parol', async (ctx) => {
    const t = db().prepare("SELECT * FROM teachers WHERE telegram_id = ? AND status = 'active'").get(ctx.from!.id) as unknown as
      | ReturnType<typeof teacherRow>
      | undefined
    if (!t) {
      await ctx.reply("Siz hali ro'yxatdan o'tmagansiz yoki hisobingiz tasdiqlanmagan.")
      return
    }
    const password = await issuePassword(t.id)
    await ctx.reply(
      `<b>Yangi parol</b>\nLogin: <code>${esc(t.login)}</code>\nParol: <code>${password}</code>\n<i>Eski parol endi ishlamaydi.</i>`,
      { parse_mode: 'HTML' },
    )
  })

  bot.command('start', async (ctx) => {
    // Panel yoki ilovadagi "Telegram'ni ulash" havolasi: /start link_<kod>
    const payload = ctx.match?.trim() ?? ''
    if (payload.startsWith('link_')) {
      const r = consumeLinkCode(payload.slice(5), ctx.from!.id)
      await ctx.reply(
        r
          ? `<b>Telegram ulandi</b>\n${esc(r.fullName)}, endi ${r.kind === 'director' ? "filialingizdagi arizalar va tasdiqlash so'rovlari" : 'takliflar va xabarlar'} shu yerga keladi.`
          : "Havola eskirgan yoki noto'g'ri. Panelda «Telegram'ni ulash» tugmasini qayta bosing.",
        { parse_mode: 'HTML' },
      )
      if (r) emitChange() // panelda "Telegram ulangan" belgisi darhol yangilansin
      if (r?.kind === 'teacher') await enableAppButton(ctx.api, ctx.chat!.id)
      return
    }
    const director = db().prepare('SELECT full_name FROM directors WHERE telegram_id = ?').get(ctx.from!.id) as { full_name: string } | undefined
    if (director) {
      await ctx.reply(`Assalomu alaykum, ${esc(director.full_name)}!\nFilialingizdagi arizalar va tasdiqlash so'rovlari shu yerga keladi.`, { parse_mode: 'HTML' })
      return
    }
    const linked = db()
      .prepare("SELECT full_name, status FROM teachers WHERE telegram_id = ? ORDER BY status = 'active' DESC")
      .get(ctx.from!.id) as { full_name: string; status: string } | undefined
    if (linked?.status === 'pending') {
      await ctx.reply(
        `Assalomu alaykum, <b>${esc(linked.full_name.split(' ')[0] ?? '')}</b>!\nArizangiz filial direktorida ko'rib chiqilmoqda — tasdiqlanishi bilan shu chatga xabar keladi.\n\n<i>Ma'lumotni o'zgartirish kerak bo'lsa: /royxat</i>`,
        { parse_mode: 'HTML' },
      )
      return
    }
    const dirReq = db().prepare("SELECT 1 FROM director_requests WHERE telegram_id = ? AND status = 'pending'").get(ctx.from!.id)
    if (!linked && dirReq) {
      await ctx.reply("Direktorlik arizangiz umumiy rahbariyatda ko'rib chiqilmoqda — tasdiqlanishi bilan shu chatga xabar keladi.\n\n<i>Ma'lumotni o'zgartirish: /royxat</i>", {
        parse_mode: 'HTML',
      })
      return
    }
    if (linked?.status !== 'active') {
      // Ro'yxatdan o'tmagan (yoki rad etilgan) — bot savollar beradi (botRegister.ts)
      await startRegistration(ctx)
      return
    }
    await enableAppButton(ctx.api, ctx.chat!.id)
    const kb = appButton(new InlineKeyboard(), 'Ilovani ochish', 'today')
    const hasButton = kb.inline_keyboard.some((row) => row.length > 0)
    await ctx.reply(`Assalomu alaykum, ${esc(linked.full_name)}!\nKela olmasangiz yoki o'rinbosar takliflarini ko'rish uchun ilovani oching.`, {
      parse_mode: 'HTML',
      reply_markup: hasButton ? kb : undefined,
    })
  })

  // Taklifga bot ichidan javob berish
  bot.callbackQuery(/^offer:([yn]):(.+)$/, async (ctx) => {
    const [, answer, offerId] = ctx.match!
    const t = db().prepare('SELECT id FROM teachers WHERE telegram_id = ?').get(ctx.from.id) as { id: string } | undefined
    if (!t) return ctx.answerCallbackQuery({ text: 'Avval ilovaga kiring', show_alert: true })
    try {
      respondOffer(t.id, offerId, answer === 'y')
      await ctx.answerCallbackQuery({ text: answer === 'y' ? "Qabul qilindi. Mas'ul tasdiqlashini kuting." : 'Rad etildi' })
      const status = answer === 'y' ? "\n\n<b>Siz rozi bo'ldingiz.</b> Mas'ul shaxs tanlasa, xabar keladi." : '\n\n<b>Siz rad etdingiz.</b>'
      await ctx.editMessageText((ctx.callbackQuery.message?.text ?? '') + status, { parse_mode: 'HTML' }).catch(() => {})
    } catch (e) {
      await ctx.answerCallbackQuery({ text: e instanceof HttpError ? e.message : 'Xato yuz berdi', show_alert: true })
    }
  })

  // Davomat: ustoz "Kelyapman" / "Kela olmayman" deb javob beradi
  bot.callbackQuery(/^at:([yn]):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const [, answer, date] = ctx.match!
    const t = db().prepare("SELECT id FROM teachers WHERE telegram_id = ? AND status = 'active'").get(ctx.from.id) as { id: string } | undefined
    if (!t) return ctx.answerCallbackQuery({ text: 'Hisobingiz topilmadi', show_alert: true })
    try {
      const r = teacherAttendanceReply(t.id, date, answer === 'y')
      const note =
        r.stage === 'coming'
          ? '\n\n<b>Rahmat, kutamiz.</b>'
          : `\n\n<b>Ariza ochildi.</b> ${r.casesCount} ta dars uchun o'rinbosar qidirilmoqda, natija haqida xabar keladi.`
      await ctx.answerCallbackQuery({ text: r.stage === 'coming' ? 'Rahmat!' : 'Ariza ochildi' })
      await ctx.editMessageText(esc(ctx.callbackQuery.message?.text ?? '') + note, { parse_mode: 'HTML' }).catch(() => {})
    } catch (e) {
      await ctx.answerCallbackQuery({ text: e instanceof HttpError ? e.message : 'Xato yuz berdi', show_alert: true })
    }
  })

  // Davomat: direktor yoki mas'ul kelmagan ustoz uchun o'rinbosar qidirishni boshlaydi
  bot.callbackQuery(/^ax:([^:]+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const [, teacherId, date] = ctx.match!
    const actors = actorsForTelegram(ctx.from.id)
    if (actors.length === 0) return ctx.answerCallbackQuery({ text: "Sizda bu huquq yo'q", show_alert: true })
    let lastError = 'Xato yuz berdi'
    for (const actor of actors) {
      try {
        const r = openAbsenceForMissing(actor, teacherId, date)
        await ctx.answerCallbackQuery({ text: "O'rinbosar qidirilmoqda" })
        const note = `\n\n<b>Ariza ochildi.</b> ${r.casesCount} ta dars uchun o'rinbosar qidirilmoqda.`
        await ctx.editMessageText(esc(ctx.callbackQuery.message?.text ?? '') + note, { parse_mode: 'HTML' }).catch(() => {})
        return
      } catch (e) {
        lastError = e instanceof HttpError ? e.message : lastError
        if (!(e instanceof HttpError && e.status === 403)) break
      }
    }
    await ctx.answerCallbackQuery({ text: lastError, show_alert: true })
  })

  // Direktor yoki mas'ul botdan o'rinbosarni tasdiqlaydi
  bot.callbackQuery(/^ch:([^:]+):(.+)$/, async (ctx) => {
    const [, caseId, chosenId] = ctx.match!
    const actors = actorsForTelegram(ctx.from.id)
    if (actors.length === 0) return ctx.answerCallbackQuery({ text: "Sizda tasdiqlash huquqi yo'q", show_alert: true })
    let lastError = 'Xato yuz berdi'
    for (const actor of actors) {
      try {
        const res = chooseCandidate(actor, caseId, chosenId)
        await ctx.answerCallbackQuery({ text: 'Tasdiqlandi' })
        const note = `\n\n<b>Siz tasdiqladingiz.</b> Darsga ${esc(res.chosenTeacher?.fullName ?? '')} kiradi.`
        await ctx.editMessageText(esc(ctx.callbackQuery.message?.text ?? '') + note, { parse_mode: 'HTML' }).catch(() => {})
        return
      } catch (e) {
        lastError = e instanceof HttpError ? e.message : lastError
        // 403 (boshqa filial / huquq yo'q) bo'lsa — keyingi rol bilan urinib ko'ramiz
        if (!(e instanceof HttpError && e.status === 403)) break
      }
    }
    await ctx.answerCallbackQuery({ text: lastError, show_alert: true })
  })

  // Ro'yxatdan o'tish (direktor ham xodim sifatida o'ta oladi — /start unga direktor salomini ko'rsatadi)
  bot.command('royxat', async (ctx) => {
    const active = db().prepare("SELECT 1 FROM teachers WHERE telegram_id = ? AND status = 'active'").get(ctx.from!.id)
    if (active) {
      dropRegistrationSession(ctx.from!.id)
      await ctx.reply("Siz allaqachon ro'yxatdan o'tgansiz.", { reply_markup: { remove_keyboard: true } })
      return
    }
    await startRegistration(ctx)
  })

  // Bot suhbatida ro'yxatdan o'tish: kontakt, matnli javoblar, tugmalar (buyruqlardan keyin ulanadi)
  setupRegistration(bot)

  bot.catch((err) => console.error('Bot xatosi:', err.error))
  void bot.start({
    onStart: (me) => {
      runtime.botUsername = me.username
      console.log(`Bot ishga tushdi: @${me.username}`)
      void setupMenu(bot).catch((e) => console.error('Bot menyusi sozlanmadi:', e instanceof GrammyError ? e.description : e))
    },
  })
  return bot
}
