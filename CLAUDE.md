# O'rinbosar tizimi — frontend

Maktab/o'quv markazi uchun o'rinbosar o'qituvchi topish tizimining **frontend** qismi.
Jamoada: bu repo = frontend (Mini App + Rahbariyat paneli). Backend va Telegram botni boshqa a'zolar qiladi.
Foydalanuvchi o'zbek tilida yozadi — javoblar, UI matnlari va hujjatlar o'zbekcha.

## Ishga tushirish
```
npm install
npm run dev      # http://localhost:5173  (/app — Mini App, /admin — panel)
npm run build
npm run lint
```
⚠️ Yo'lda `R&D` bor — `.bin` shimlar Windows'da buziladi, shuning uchun package.json skriptlari `node node_modules/...` orqali chaqiriladi. Shunday qoldiring.

## Stek
React 19 + TypeScript + Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), React Router 7, TanStack Query 5, lucide-react (ikonkalar), Manrope shrifti (Google Fonts, index.html).
Telegram: `telegram-web-app.js` skripti index.html da; o'ram — `src/lib/telegram.ts`. Deploy: Vercel (`vercel.json` SPA rewrite).

## Tuzilma
```
src/
  types.ts              — barcha ma'lumot turlari (backend JSON shakli)
  api/contract.ts       — Api interfeysi (frontend nimani chaqiradi)
  api/mock.ts           — soxta API + nomzod tanlash qoidalari (xotirada, namuna ma'lumotlar)
  api/http.ts           — haqiqiy backend (fetch, Bearer token, Telegram initData login)
  api/index.ts          — VITE_USE_MOCK=false bo'lsa http, aks holda mock
  lib/date.ts           — sana/oy/pul formatlash (o'zbekcha)
  lib/telegram.ts       — tg WebApp, startParam, haptic, BackButton hook
  lib/auth.ts           — tokenlar role bo'yicha alohida (token:teacher / token:admin); scope URL'dan (/admin...)
  lib/colors.ts         — tintOf(fan/ism) -> barqaror rang (soft/bar/gradient), initials()
  components/ui.tsx     — cx, Button(icon), Card, Badge(dot), StatusBadge, Avatar, SubjectChip, IconTile, Loading/Empty/ErrorState,
                          Alert, Field, inputClass, PageHeader, LessonInfo, Step
  components/RequireAuth.tsx — role bo'yicha himoya (teacher -> /login, admin -> /admin/login)
  components/AuthShell.tsx   — kirish sahifalari ramkasi + PasswordInput
  pages/auth/           — LoginPage (/login), RegisterPage (/register), AdminLoginPage (/admin/login)
  pages/app/            — Mini App: AppLayout (pastki menyu, startapp yo'naltirish), TodayPage, AbsencePage,
                          OffersPage, SubstitutionsPage, CoordinatorListPage, CoordinatorCasePage
  pages/admin/          — Panel: AdminLayout (+AdminHeader, selectClass), DashboardPage, SchedulePage,
                          TeachersPage, SettingsPage, ReportPage
docs/api.md             — backend uchun endpointlar, qoidalar, bot havolalari, ochiq savollar
```

## Tashkilotlar va mavzular
- 3 tashkilot: bog'cha (yashil #13B87A / to'q ko'k #13213B / sariq #F1C81E, Nunito), maktab (to'q ko'k→ko'k gradient), akademiya (#2A539B). Logolar: public/logos/{kindergarten,school,academy}.png.
- Ranglar faqat CSS o'zgaruvchilar orqali: `<html data-org>` → index.css bloklari → Tailwind `brand`, `brand-strong`, `brand-dark`, `brand-accent`, `app`. Komponentlarda blue/indigo yozmang — `from-brand to-brand-strong` ishlating.
- lib/org.ts: ORGS (nom, logo, so'zlar: staff/group/lesson), useApplyOrg(org). Mini App: me.org bo'yicha; Register: tanlangan filial bo'yicha; admin: sidebar'dagi tanlov (lib/adminOrg.ts, localStorage `admin-org`, useOrgBranches() bilan sahifalar filtrlanadi).
- Emoji yo'q (foydalanuvchi so'rovi).

## Dizayn (foydalanuvchi tanlovi: rangli, jonli)
- Brend: ko'k → indigo → binafsha gradientlar (`bg-linear-to-br from-blue-600 to-indigo-600`). Holatlar: emerald=topildi, amber=kutilmoqda, rose=topilmadi.
- Har bir fan/odamga `tintOf()` orqali o'z rangi. Emoji o'rniga lucide ikonkalar.
- Mini App: gradient hero, suzuvchi pastki menyu, dars timeline. Panel: to'q gradient sidebar, IconTile statistika kartalari.
- `Card` className'da `p-*` bo'lsa standart `p-4` qo'shilmaydi.

## Kelishuvlar
- Har sahifada 3 holat: yuklanmoqda / bo'sh / xato (`LoadingState`, `EmptyState`, `ErrorState`).
- Mini App ranglari `tg-*` Tailwind ranglari (Telegram mavzusidan, fallback bilan) — `src/index.css`.
- Yangi endpoint: avval `types.ts` → `contract.ts` → `mock.ts` + `http.ts` → `docs/api.md`.
- Hisoblar: o'qituvchi o'zi ro'yxatdan o'tadi -> `pending` -> admin TeachersPage'da tasdiqlaydi. Admin o'qituvchi qo'shmaydi.
- Mock baza localStorage'da (`orinbosar-mock-db`) — barcha oynalar uchun umumiy; `storage` hodisasida queryClient.invalidateQueries() (main.tsx). Panel sidebar'da "Boshlang'ich holatga qaytarish". DB tuzilmasi o'zgarsa `DB_VERSION` ni oshiring.
- Mock token = `mock.<userId>`; joriy foydalanuvchi tokendan olinadi (`meId()`). Demo: aziza/123456 (t1, mas'ul), kamola/123456 (pending), admin/admin123.
- Login/logout'da `queryClient.clear()` — boshqa foydalanuvchi ma'lumoti qolmasin.
- Emoji ishlatilmaydi (foydalanuvchi so'rovi) — faqat lucide ikonkalar.

## Ma'lum kamchiliklar / keyingi ishlar
- Parolni tiklash ("parolni unutdim") yo'q — hozircha admin orqali hal qilinadi deb faraz.
- Excel import faqat faylni backendga yuboradi; fayl formati hali kelishilmagan.
- `noticeHours` Mini App'da tekshirilmaydi (backend tekshiradi deb faraz qilingan).

## Vizual tekshirish
Chrome kengaytmasi localhost'ga ulanmaydi. O'rniga headless Chrome: `chrome.exe --headless=new --virtual-time-budget=4000 --window-size=500,1000 --screenshot=out.png http://localhost:5173/app` (kenglik <500 bo'lsa qirqiladi). Konsol xatolari: `--enable-logging=stderr --dump-dom`. Kirgan holatni ko'rish uchun vaqtincha `public/__dev_token.html` (localStorage.token = ?t=mock.t1) yaratib, keyin o'chirish.

## O'zgarishlar jurnali
- **2026-11-20** — Loyiha yaratildi. Mini App (o'qituvchi: bosh sahifa, "Kela olmayman", takliflar, o'rinbosar darslarim; mas'ul: nomzodlar ro'yxati va tanlash) va Rahbariyat paneli (bugungi holat, jadval + Excel yuklash, o'qituvchilar CRUD, sozlamalar, oylik hisobot + CSV) mock ma'lumotlar bilan. `docs/api.md` yozildi. Build va lint toza.
- **2026-11-20** — Dizayn to'liq yangilandi (rangli/jonli uslub, ko'k brend): lucide-react, Manrope, lib/colors.ts, yangi UI komponentlar; barcha Mini App va panel sahifalari qayta bezatildi; "Kela olmayman"ga tezkor sana/sabab tugmalari; hisobotda progress chiziqlari va jami kartalar; sozlamalarda switch. Xato tuzatildi: useEffect qiymat qaytarib AppLayout buzilgan edi.
- **2026-11-20** — Hisoblar: o'qituvchi o'zi ro'yxatdan o'tadi (login/parol, fanlar, filial), admin tasdiqlaydi/rad etadi; /login, /register, /admin/login sahifalari; RequireAuth himoyasi; Mini App va panelda "Chiqish"; panelda tasdiq kutayotganlar soni belgisi; "Qo'shish" tugmasi olib tashlandi; 👋 olib tashlandi. API: /auth/login, /auth/register, /admin/teachers/:id/approve|reject.
- **2026-11-20** — Bir brauzerda ikki oynada sinash: mock baza localStorage'da umumiy va oynalar orasida jonli yangilanadi; o'qituvchi va admin tokenlari alohida. Register → admin approve → login oqimi headless Chrome'da tekshirildi.
- **2026-11-20** — 3 tashkilot (bog'cha/maktab/akademiya) uchun alohida dizayn: logolar, ranglar, shrift, so'zlar; Branch.org, Me.org; admin panelda tashkilot tanlash va filtr; mock'ga akademiya va bog'cha xodimlari (shahzod, gulnora ... parol 123456). DB_VERSION=4.
