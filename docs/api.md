# API shartnomasi (frontend ↔ backend)

Bu hujjat **backend dasturchi uchun**. Frontend aynan shu endpointlarni chaqiradi.
Ma'lumot turlari (JSON shakli) — `src/types.ts` faylida, interfeys — `src/api/contract.ts`.
Ishlaydigan namunaviy mantiq (nomzod tanlash qoidalari bilan) — `src/api/mock.ts`.

Umumiy qoidalar:
- Asosiy manzil: `VITE_API_URL` (masalan `https://api.example.uz/api`)
- Hamma so'rovlarda: `Authorization: Bearer <token>`
- Sanalar: `"YYYY-MM-DD"`, oy: `"YYYY-MM"`, vaqt: `"HH:MM"`
- Xato bo'lsa: HTTP 4xx/5xx + `{ "message": "Foydalanuvchiga ko'rsatiladigan o'zbekcha matn" }`
- Hafta kuni: `1` = Dushanba … `6` = Shanba

## Tashkilotlar

Uchta tashkilot bor: `kindergarten` (bog'cha), `school` (maktab), `academy` (akademiya). Har bir **filial** bittasiga tegishli:
`Branch = { id, name, org }`. `Me.org` — xodim filialining tashkiloti (frontend shu bo'yicha dizayn va so'zlarni tanlaydi: bog'chada "tarbiyachi", "guruh", "mashg'ulot"). Admin uchun `org` bo'sh.

## Hisoblar va kirish

Har bir o'qituvchi **o'zi ro'yxatdan o'tadi** (login + parol). Hisob `pending` holatda yaratiladi va
**rahbariyat tasdiqlamaguncha kira olmaydi**. Rahbariyat ham login/parol bilan kiradi (`role: "admin"`).

| Metod | Yo'l | Body | Javob |
|---|---|---|---|
| POST | `/auth/register` | `RegisterInput` = `{ fullName, phone, branchId, subjects: string[], login, password }` | `{ status: "pending" }` |
| POST | `/auth/login` | `{ login, password, initData? }` | `{ token, user: Me }` |
| GET | `/branches` | — (token shart emas, ro'yxatdan o'tish formasi uchun) | `Branch[]` |

Qoidalar (mock.ts da ham shunday):
- Login: 4–20 ta `a-z 0-9 _ .`, kichik harfga o'tkaziladi, unikal. Parol: kamida 6 belgi. **Parol faqat hash (bcrypt/argon2) holida saqlansin.**
- `pending` hisob bilan login → 403 + `{ message: "Hisobingiz hali tasdiqlanmagan..." }`; `rejected` → 403.
- `initData` kelsa (Mini App Telegram ichida ochilgan), backend uni bot tokeni bilan **tekshirib** (HMAC-SHA256), Telegram `user.id` ni shu o'qituvchiga bog'laydi → `telegramLinked = true`. Bot xabarlari shu id ga yuboriladi.
- Token eskirsa — 401; frontend tokenni o'chirib, kirish sahifasiga qaytaradi.
- `Me.role`: `"teacher"` yoki `"admin"`. Admin endpointlari teacher token bilan 403 qaytarsin.

## O'qituvchi (Mini App)

| Metod | Yo'l | Body / Parametr | Javob |
|---|---|---|---|
| GET | `/me` | — | `Me` |
| GET | `/me/lessons?date=` | — | `Lesson[]` — shu sanadagi (hafta kuni bo'yicha) darslarim |
| GET | `/me/offers` | — | `Offer[]` — menga kelgan hamma takliflar |
| POST | `/offers/:id/accept` | — | `Offer` |
| POST | `/offers/:id/reject` | — | `Offer` |
| GET | `/me/substitutions` | — | `Offer[]` — men qabul qilgan (status=accepted) takliflar |
| POST | `/absences` | `{ date, reason, lessonIds: string[] }` | `{ id, casesCount }` |

`POST /absences` qilinganda backend:
1. Har bir tanlangan dars uchun `CoverCase` (status `pending`) yaratadi.
2. Har bir holat uchun mos ustozlarni topadi (pastdagi qoidalar) va ko'pi bilan 3 tasiga `Offer` yuboradi + bot orqali xabar.
3. Mos ustoz bo'lmasa — status `not_found`.

## Mas'ul shaxs (Mini App)

| Metod | Yo'l | Body | Javob |
|---|---|---|---|
| GET | `/cases` | — | `CoverCase[]` — mas'ulning filialidagi bugungi va kelgusi holatlar |
| GET | `/cases/:id` | — | `CoverCase` |
| POST | `/cases/:id/choose` | `{ teacherId }` | `CoverCase` (status → `found`) |

`choose` dan keyin: tanlangan ustozga bot xabari, javob bermagan takliflar `expired`.

## Rahbariyat paneli

| Metod | Yo'l | Body / Parametr | Javob |
|---|---|---|---|
| GET | `/admin/overview?date=&branchId=` | branchId ixtiyoriy | `DayOverview` |
| GET | `/admin/schedule?branchId=` | — | `Lesson[]` |
| POST | `/admin/schedule/import` | `multipart/form-data`, maydon `file` (.xlsx/.xls/.csv) | `{ imported: number, errors: string[] }` |
| GET | `/admin/teachers` | — | `Teacher[]` (hamma statusdagilar: `pending`, `active`, `rejected`) |
| PUT | `/admin/teachers/:id` | `TeacherInput` = `{ id, fullName, phone, subjects, branchId, isCoordinator }` | `Teacher` |
| POST | `/admin/teachers/:id/approve` | — | `Teacher` (status → `active`) |
| POST | `/admin/teachers/:id/reject` | — | `Teacher` (status → `rejected`) |

Admin o'qituvchi **qo'shmaydi** — faqat tasdiqlaydi, rad etadi yoki tahrirlaydi. Nomzodlar, jadval va hisobotda faqat `active` o'qituvchilar hisobga olinadi.
| GET | `/admin/settings` | — | `Settings` |
| PUT | `/admin/settings` | `Settings` | `Settings` |
| GET | `/admin/reports/monthly?month=` | — | `MonthlyReportRow[]` |

## Nomzod tanlash qoidalari (mock.ts dagi `rankFreeTeachers`)

Ustoz nomzod bo'la oladi, agar:
1. O'sha kuni o'zi kelmayotgan bo'lmasa;
2. O'sha kuni o'sha parada o'z darsi bo'lmasa;
3. O'sha kuni tanlangan o'rinbosar darslari soni `< settings.dailyLimit`;
4. Filiali bir xil (yoki `settings.allowCrossBranch = true`).

Saralash: avval fani mos keladiganlar, keyin shu oyda kamroq o'rinbosar bo'lganlar. Birinchi 3 tasiga taklif yuboriladi.
Hamma taklif rad etilsa / muddati o'tsa → `not_found`.

## Bot ↔ Mini App havolalari

Bot xabaridagi tugma Mini App ni aniq sahifada ochishi uchun `startapp` parametri:

| Parametr | Ochiladigan sahifa |
|---|---|
| `offers` | Takliflar |
| `case_<caseId>` | Mas'ul shaxs: shu dars uchun nomzod tanlash |
| `absence` | "Kela olmayman" formasi |

Masalan: `https://t.me/<bot_nomi>/<app_nomi>?startapp=case_c123`

## Ochiq savollar (jamoa bilan hal qilish kerak)

- Excel jadval faylining aniq ustunlari (kun, para, vaqt, sinf, fan, o'qituvchi, xona?) — namunaviy fayl kerak.
- Taklifga javob berish muddati qancha (masalan 30 daqiqa)? Undan keyin `expired`.
- `noticeHours` buzilsa nima bo'ladi — ariza rad etiladimi yoki faqat ogohlantirish?
- Haq: hamma darsga bir xil summami yoki fan/toifaga qarab?
