// Mantiq va bot o'rtasidagi ko'prik. Mantiq faqat "nima bo'ldi"ni aytadi,
// bot (bot.ts) bularni Telegram xabarlariga aylantiradi. Bot yo'q bo'lsa — hech narsa qilinmaydi.
// Har bir hodisa ma'lumot o'zgarganini bildiradi — ochiq sahifalarga jonli yangilanish signali ham ketadi (events.ts).
import { emitChange } from './events.ts'

export interface Notifier {
  /** Yangi "Kela olmayman" arizasi (mas'ulga; kech bo'lsa belgisi bilan) */
  absenceCreated(absenceId: string): void
  /** Ustozga "o'rniga kira olasizmi?" taklifi */
  offerCreated(offerId: string): void
  /** Taklifga belgilangan muddatda javob berilmadi (ustozga) */
  offerExpired(offerId: string): void
  /** Ustoz taklifni qabul qildi (mas'ulga: tanlash kerak) */
  offerAccepted(offerId: string): void
  /** O'rinbosar topilmadi (mas'ulga) */
  caseNotFound(caseId: string): void
  /** Davomat: ustozdan "bugun kelyapsizmi?" deb so'rash */
  attendanceAsk(teacherId: string, date: string): void
  /** Davomat: ustoz hali kelmadi va javob bermadi (yoki Telegram ulanmagan) — direktor/mas'ulga */
  attendanceEscalate(teacherId: string, date: string, reason: 'no_answer' | 'no_telegram'): void
  /** Davomat: xabar berilgandan keyin ustoz "kelyapman" dedi — direktor/mas'ulga */
  attendanceComing(teacherId: string, date: string): void
  /** O'rinbosar tasdiqlandi (tanlanganga, kelmaydiganga, boshqa nomzodlarga va boshqa tasdiqlovchilarga) */
  caseChosen(caseId: string, expiredOfferIds: string[], actor: { role: string; id: string }): void
  /** Bot orqali yangi xodim ro'yxatdan o'tdi (filial direktori va mas'ulga: tasdiqlash tugmalari) */
  teacherRegistered(teacherId: string): void
  /** Xodim arizasi tasdiqlandi yoki rad etildi (xodimning o'ziga) */
  teacherDecided(teacherId: string, status: 'active' | 'rejected'): void
  /** Mini App ochildi, lekin xodim ro'yxatdan o'tmagan — bot chatda savollarni boshlaydi */
  registrationRequested(telegramId: number): void
  /** Botdan direktorlik arizasi (umumiy rahbariyat panelda ko'radi) */
  directorRequested(requestId: string): void
  /** Direktorlik arizasi hal qilindi — arizachiga (tasdiqlansa login va parol bilan) */
  directorDecided(requestId: string, approved: boolean, creds?: { login: string; password: string }): void
}

const noop = () => {}

/** Haqiqiy ishlovchilar (bot o'rnatadi) */
const impl: Notifier = {
  absenceCreated: noop,
  offerCreated: noop,
  offerExpired: noop,
  offerAccepted: noop,
  caseNotFound: noop,
  attendanceAsk: noop,
  attendanceEscalate: noop,
  attendanceComing: noop,
  caseChosen: noop,
  teacherRegistered: noop,
  teacherDecided: noop,
  registrationRequested: noop,
  directorRequested: noop,
  directorDecided: noop,
}

/** Mantiq chaqiradigan obyekt: ishlovchini chaqiradi va sahifalarga "o'zgardi" signalini beradi */
export const notify = Object.fromEntries(
  (Object.keys(impl) as (keyof Notifier)[]).map((k) => [
    k,
    (...args: unknown[]) => {
      ;(impl[k] as (...a: unknown[]) => void)(...args)
      emitChange()
    },
  ]),
) as unknown as Notifier

/** Berilgan hodisalar almashtiriladi, qolganlari avvalgicha (testlarda qisman berish mumkin) */
export function setNotifier(n: Partial<Notifier>) {
  Object.assign(impl, n)
}
