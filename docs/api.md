# API shartnomasi (frontend ↔ backend)

Bu hujjat **backend dasturchi uchun**. Frontend aynan shu endpointlarni chaqiradi.
Ma'lumot turlari (JSON shakli) — `src/types.ts` faylida, interfeys — `src/api/contract.ts`.
**Haqiqiy backend:** `server/` papkasi (Node + Hono + SQLite + grammY). Mantiq — `server/src/logic.ts`.

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

### Ro'yxatdan o'tish — bot CHATINING o'zida (asosiy yo'l: `server/src/botRegister.ts` + `tgRegister.ts`)

Bot savol beradi, xodim chatda javob yozadi / tugma bosadi:
banner "Xush kelibsiz" -> 1) ism-familiya (matn, bitta xabarda; faqat ism bo'lsa familiya so'raladi) -> 2) telefon (reply "Raqamni ulashish"
yoki qo'lda yozish) -> 3) Maktab/Akademiya/Bog'cha -> 4) filial -> 5) fanlar (tugmalar, ko'p tanlov, faqat standart ro'yxat) ->
"Hammasi to'g'rimi?" (har qismni alohida tuzatish) -> banner "Ariza yuborildi" (login). Boshlash: /start (ro'yxatdan o'tmagan) yoki /royxat.
Holat `tg_reg_sessions` da. Tasdiqlanganda banner "Hisobingiz faollashdi" + login/parol, va shu chatga "Ilova" menyu tugmasi
(`setChatMenuButton` chat bo'yicha; umumiy menyu — buyruqlar).

| Metod | Yo'l | Body | Javob |
|---|---|---|---|
| POST | `/auth/tg-status` | `{ initData }` | `TgStatus` = `{ status: none\|pending\|rejected\|active, phone, suggestedName, firstName, lastName, login?, fullName?, branchId? }` |
| POST | `/auth/tg-chat-register` | `{ initData }` | `{ ok: true }` — bot shu odamga chatda 1-savolni yuboradi (Mini App ochilgan, lekin ro'yxatdan o'tmagan; sahifa `/join` keyin ilovani yopadi) |

- Telefon: ulashilgan kontakt (`contact.user_id === from.id`) — tasdiqlangan; qo'lda yozilgan — tasdiqlanmagan. Qo'lda yozilgan raqam bazadagi xodimniki bo'lsa — faqat ulashish bilan bog'lanadi.
- Fanlar: `SCHOOL_SUBJECTS` (tgRegister.ts) + filial jadvalidagi fanlar; bog'chada `KINDERGARTEN_POSITIONS`. Boshqasi rad etiladi.
- Lavozim (5-qadam): O'qituvchi / Mas'ul shaxs (`is_coordinator`, direktor tasdiqlaydi) / Filial direktori (fan so'ralmaydi; umumiy rahbariyat tasdiqlaydi):

| Metod | Yo'l | Javob |
|---|---|---|
| GET | `/admin/director-requests` (faqat admin) | `DirectorRequest[]` = `{ id, fullName, phone, branchId, branchName, currentDirector, createdAt }` |
| POST | `/admin/director-requests/:id/approve` | `{ ok }` — shu filial direktori bo'ladi (bor bo'lsa almashtiriladi), Telegram ulanadi, login + parol botga |
| POST | `/admin/director-requests/:id/reject` | `{ ok }` — arizachiga botda xabar |
- Login avtomatik: ismning birinchi so'zi (lotinga, apostrofsiz) + telefonning oxirgi 4 raqami (`aziza4567`), band bo'lsa `_2`.
- Parol ro'yxatda berilmaydi (`password_pending = 1`); tasdiqlanganda 6 xonali parol yaratilib botga yuboriladi. `/parol` — yangi parol. Telegram ichida parol kerak emas.
- Telefon bo'yicha mavjud xodim (masalan davomatdan import) topilsa — shu yozuvga bog'lanadi; u faol bo'lsa darhol kiradi (dublikat yo'q).
- Bot: yangi arizani filial direktori va mas'uliga "Tasdiqlash / Rad etish" tugmalari bilan yuboradi (`reg:y|n:<id>`), natijani xodimga.

## Jonli yangilanish

| Metod | Yo'l | Javob |
|---|---|---|
| GET | `/events?token=<token>` | SSE oqimi: `ready` (ulanganda), `change` (ma'lumot o'zgardi — ichida ma'lumot yo'q), `ping` (25 s) |
| GET | `/changes` (Bearer) | `{ v }` — o'zgarishlar hisoblagichi; SSE o'tmasa sahifa har 3 s so'raydi |

`change` kelganda frontend ochiq so'rovlarni qayta yuklaydi (`src/lib/live.ts`). Signal manbalari: muvaffaqiyatli POST/PUT so'rovlar va barcha bot/fon hodisalari (`notify.*`). Prod'da nginx bo'lsa SSE uchun bufer o'chiq (`X-Accel-Buffering: no` yuboriladi).

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

## Nomzod tanlash qoidalari (server/src/logic.ts — `rankCandidates`)

Excel fayldagi "Test ssenariylari" (19 ta) bo'yicha tekshirilgan: `cd server && npm run test:scenarios`.

Ustoz nomzod bo'la oladi, agar:
1. Faol, kelmaydigan ustozning o'zi emas va o'sha kuni o'zi ham kelmayotgan bo'lmasa;
2. Filiali bir xil (yoki `settings.allowCrossBranch = true`);
3. **Bu fanni o'ta olsa** — `subjects` (asosiy) yoki `extraSubjects` (qo'shimcha) ichida bo'lsa. Fani mos kelmaganlar nomzod EMAS;
4. O'sha kuni o'sha parada o'z darsi ham, boshqa o'rinbosarlik majburiyati ham bo'lmasa;
5. O'sha kungi majburiyatlari soni `< settings.dailyLimit`.
   Majburiyat = o'sha kungi boshqa holatdagi javob kutilayotgan/qabul qilingan taklif yoki tanlangan holat.

Saralash: avval asosiy fani mos keladiganlar, keyin bu oy kamroq o'rinbosar bo'lganlar.
Birinchi 3 tasiga taklif yuboriladi. Kimdir **rad etsa — navbatdagi nomzodga** yangi taklif ketadi.
Hech qanday faol taklif qolmasa — holat `not_found`, mas'ulga bot xabari.

**Javob berish muddati:** `settings.offerTimeoutMinutes` (standart 30 daqiqa). Shu vaqt ichida javob berilmagan taklif `expired` bo'ladi
(server har 30 soniyada tekshiradi) va navbatdagi nomzodga yangi taklif ketadi. Javob kutilayotgan `Offer` da `expiresAt` (ISO) bor.
Qabul qilingan taklif muddat bilan yopilmaydi — u mas'ul tanlashini kutadi.
Bir arizadagi darslar para tartibida ko'riladi (kunlik chegara to'g'ri hisoblanishi uchun).

**Xabar berish muddati:** `settings.noticeDeadline` ("07:00"). Dars kuni shu soatdan keyin yuborilgan ariza
qabul qilinadi, lekin `CoverCase.lateNotice = true` va mas'ulga "Kech xabar berildi" belgisi bilan boradi.

## Bot ↔ Mini App havolalari

Bot xabaridagi tugma Mini App ni aniq sahifada ochishi uchun `startapp` parametri:

| Parametr | Ochiladigan sahifa |
|---|---|
| `offers` | Takliflar |
| `case_<caseId>` | Mas'ul shaxs: shu dars uchun nomzod tanlash |
| `absence` | "Kela olmayman" formasi |
| `cases` | Mas'ul shaxs: holatlar ro'yxati |
| `substitutions` | O'rinbosar darslarim |

`MINIAPP_LINK` berilmagan bo'lsa bot `web_app` tugmasi bilan `WEBAPP_URL/app?startapp=...` ochadi — frontend ikkalasini ham tushunadi.

Masalan: `https://t.me/<bot_nomi>/<app_nomi>?startapp=case_c123`


## Ochiq savollar (jamoa bilan hal qilish kerak)

- Haq: hamma darsga bir xil summami yoki fan/toifaga qarab? (Hozir bir xil: `paymentPerLesson`.)
- Admin jadval importi faqat "Dars jadvali" va "Qo'ng'iroqlar" varaqlarini o'qiydi; o'qituvchilar F.I.Sh. bo'yicha topiladi.

## Rollar: rahbariyat, filial direktori, o'qituvchi

| Rol | Qayerga kiradi | Nimani ko'radi |
|---|---|---|
| `admin` (umumiy rahbariyat, `.env` dagi ADMIN_LOGIN) | Panel `/admin` | Hamma filiallar; filiallar va direktorlarni boshqaradi; sozlamalarni o'zgartiradi |
| `director` (filial direktori) | Panel `/admin` | FAQAT o'z filiali: holat, jadval, o'qituvchilar, hisobot. Sozlamalar — faqat o'qish |
| `teacher` (mas'ul bo'lsa ham) | Mini App `/app` | O'z darslari, takliflar; mas'ul — o'z filiali holatlari |

Server `/admin/*` so'rovlarida direktorning filialini majburan qo'llaydi (`branchId` parametri e'tiborga olinmaydi).
Login hamma rollar orasida yagona. `POST /auth/login` direktor uchun `user.role = "director"` qaytaradi.

**O'rinbosarni tasdiqlash:** direktor YOKI mas'ul (yoki rahbariyat) — birinchi tasdiq yetarli. `CoverCase.chosenBy` —
"Direktor: Ism" / "Mas'ul: Ism" / "Rahbariyat". Keyingi urinish 409 + kim tasdiqlagani.

| Metod | Yo'l | Kim | Body | Javob |
|---|---|---|---|---|
| POST | `/admin/cases/:id/choose` | admin, director | `{ teacherId }` | `CoverCase` |
| POST | `/cases/:id/choose` | mas'ul (ham admin/director) | `{ teacherId }` | `CoverCase` |
| GET | `/admin/branches` | admin | — | `AdminBranch[]` (direktor + faol o'qituvchilar soni) |
| POST | `/admin/branches` | admin | `{ name, org }` | `AdminBranch` |
| PUT | `/admin/branches/:id` | admin | `{ name, org }` | `AdminBranch` |
| PUT | `/admin/branches/:id/director` | admin | `DirectorInput` (yangi — parol majburiy; mavjud — bo'sh parol o'zgarmaydi) | `AdminBranch` |
| POST | `/me/telegram-link` | teacher, director | — | `{ url, expiresInMinutes }` — `t.me/<bot>?start=link_<kod>`, 15 daqiqa, bir martalik |
| PUT | `/admin/settings` | faqat admin | `Settings` | `Settings` |

Bot: tasdiqlovchilarga (direktor + mas'ullar) "Nomzod rozi bo'ldi" xabari **"Tasdiqlash"** tugmasi bilan keladi
(`callback_data = ch:<caseId>:<teacherId>`); tasdiqlangach qolganlariga "O'rinbosar tasdiqlandi, tasdiqladi: ..." boradi.

## Davomat tizimi integratsiyasi (1-bosqich: filiallar va xodimlar)

Manba: jamoaning davomat tizimi (`keldi-ketdi/davomat/api_server.py`, "Xodim Plus" API). **Faqat o'qiladi**, davomatga hech narsa yozilmaydi.
Server `.env`: `DAVOMAT_URL`, `DAVOMAT_LOGIN`, `DAVOMAT_PASSWORD` (davomat jamoasidan faqat o'qish huquqli alohida hisob).

Nomlar farqi: davomatda `branch` = yo'nalish (Mudarris Maktabi / Kids / Akademiyasi), `department` = filial.
Bizda: `Branch` = davomatdagi department (`branches.davomat_id`), `Branch.org` yo'nalish nomidan (Maktab -> school, Kids -> kindergarten, Akadem -> academy).
O'qituvchi davomatdagi xodimga `teachers.davomat_code` (= `employeeCode`, 9 xonali telefon) orqali bog'lanadi.

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| GET | `/admin/davomat/status` | admin, director | `{ enabled, url }` |
| POST | `/admin/davomat/sync-branches` | admin | `DavomatSyncResult` — davomat_id, bo'lmasa nom bo'yicha; takror bosish xavfsiz; bizdagi filial o'chirilmaydi |
| GET | `/admin/davomat/employees` | admin, director (o'z filiali) | `DavomatEmployeeView[]` — `linked` / `match` (shu filialda shu ismli o'qituvchi bor) / `new` / `no_branch` |
| POST | `/admin/davomat/import` | admin, director | `{ codes }` -> `DavomatImportResult` |

Import: `match` -> mavjud o'qituvchiga kod bog'lanadi; `new` -> faol o'qituvchi, login = kod, tasodifiy parol (faqat javobda bir marta), telefon koddan.
Fanlar bo'sh qoladi: dars jadvali (Excel) yuklanganda fanlari bo'sh o'qituvchiga o'z darslaridagi fanlar yoziladi.
Ismlar so'zlar tartibi va apostroflarsiz solishtiriladi ("Aʼzamov Abdulhamid" = "Abdulhamid A'zamov") — import va jadval yuklashda.
Davomatda hamma xodim bor (o'qituvchi bo'lmaganlar ham) — kim o'qituvchi ekanini panelda odam belgilaydi.

Tekshiruv: `cd server && node scripts/davomat-check.ts` (ishlab turgan server + davomat API; test bazasida).

## Davomat: "kelmadi" signali (2-bosqich)

Sozlama: `attendanceCheck` (yoqish), `attendanceAskMinutes` (birinchi darsdan necha daqiqa oldin, 5–180, standart 30),
`attendanceEscalateMinutes` (javob bo'lmasa necha daqiqadan keyin, 5–120, standart 15). Faqat davomatga bog'langan (`davomat_code`) va shu kuni darsi bor ustozlar.
Server har daqiqada `attendanceSweep()` (server/src/attendance.ts). Davomat `/attendance/records?from=D&to=D` — bugun faqat kelganlar qaytadi;
xodim `employee.id` = kod (raqam) yoki crc32 (`davomatEmployeeId`). Yakshanba va darsdan 60 daqiqa o'tgach yangi tekshiruv boshlanmaydi.

**Avtomatik ariza ochilmaydi** (kamera tanimay qolishi mumkin). Holatlar (`attendance_checks`, ustoz+kun): `asked` -> `coming` | `escalated` -> `absence_created`; kirish paydo bo'lsa `present`.
1. Kirish yo'q, Telegram ulangan -> bot ustozga "Kelyapsizmi?" (`at:y:<sana>` / `at:n:<sana>`). "Kela olmayman" -> qolgan darslar uchun ariza.
2. Telegram ulanmagan yoki javob yo'q -> direktor + mas'ullarga "Ustoz hali kelmadi" (`ax:<teacherId>:<sana>` — "O'rinbosar qidirish").
3. Kech "kelyapman" desa — tasdiqlovchilarga xabar.

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| GET | `/admin/attendance/missing?date=` | admin, director (o'z filiali) | `{ enabled, items: AttendanceMissing[] }` |
| POST | `/admin/attendance/absence` | admin, director | `{ teacherId, date }` -> `{ casesCount, fullName }` — ariza ochiladi, o'rinbosar qidiriladi |

Testlar: `npm run test:scenarios` (soxta davomat bilan butun kun: 18 ta davomat testi).

## Birlashtirilgan oylik hisobot (3-bosqich)

`GET /admin/reports/monthly?month=YYYY-MM` endi `MonthlyReport` qaytaradi: `{ month, rows: MonthlyReportRow[], davomat: { enabled, ok, error? } }`
(oldin — massiv edi). Direktor — faqat o'z filiali.

Davomatga bog'langan ustozda `row.davomat` (server/src/reports.ts, davomat `/reports/monthly` + `/attendance/records?status=absent`):
`workingDays, presentDays, absentDays, lateDays, lateMinutes, workedMinutes, unexplainedAbsentDates`.
**Sababsiz kelmagan** = davomatda "absent" (ish kuni, kirish yo'q) VA shu kunga tizimda ariza (`absences`) yo'q, bugundan oldingi kunlar.
Davomat ishlamasa — `davomat.ok = false` + `error`, qatorlar davomatsiz qaytadi (hisobot buzilmaydi). Kelajak oy — davomat so'ralmaydi.
CSV eksportda davomat ustunlari ham bor.

## Filial bo'yicha sozlamalar: umumiy -> tashkilot turi -> filial

Amaldagi qiymat = umumiy + `org:<school|academy|kindergarten>` + `branch:<id>` (pastkisi ustun; faqat o'zgartirilgan maydonlar saqlanadi — `settings_overrides`).
Alohida bo'la oladigan maydonlar (`BRANCH_SETTING_KEYS`): `noticeDeadline, dailyLimit, offerTimeoutMinutes, paymentPerLesson, workDays, attendanceCheck, attendanceAskMinutes, attendanceEscalateMinutes`.
`allowCrossBranch` — faqat umumiy. `workDays` — 1..7 (7 = yakshanba; Excel'da "Yakshanba" ham o'qiladi).

Qayerda qaysi filial: ariza (ish kuni, kech xabar) — ustoz filiali; kunlik chegara — nomzodning filiali; taklif muddati — dars filiali;
haq — ustoz filiali; davomat signali — ustoz filiali. `Me.workDays` — Mini App sana tanlovi uchun.

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| GET | `/admin/settings` | admin -> umumiy; director -> o'z filialida amaldagi | `Settings` |
| PUT | `/admin/settings` | admin | `Settings` (umumiy) |
| GET | `/admin/settings/tree` | admin (hammasi), director (o'z filiali + tashkiloti) | `SettingsTree` |
| PUT | `/admin/settings/override` | admin — org/branch; director — faqat o'z filiali | `{ scope: 'org'\|'branch', id, values: SettingsOverride }` -> `SettingsTree`; bo'sh `values` = merosga qaytarish |

## Panel statistikasi

`GET /admin/stats?to=YYYY-MM-DD&days=7&org=&branchId=` -> `DashboardStats`: `week` — `to` gacha `days` kun (1–62) har kun `{ absences, found, pending, notFound }`; `upcoming` — bugundan keyingi 7 kundagi arizalar. Direktor — o'z filiali.
