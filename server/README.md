# O'rinbosar tizimi — backend va Telegram bot

Node 24 (o'rnatilgan `node:sqlite` va TypeScript), Hono (HTTP), grammY (bot), exceljs (Excel), bcryptjs.
Build bosqichi yo'q — `.ts` fayllar Node'da to'g'ridan-to'g'ri ishlaydi.

## Ishga tushirish

```
cd server
npm install
cp .env.example .env          # JWT_SECRET, ADMIN_PASSWORD, BOT_TOKEN, WEBAPP_URL ni to'ldiring
npm run seed                  # data/orinbosar_test_jadvali.xlsx dan bazani to'ldiradi
npm run dev                   # http://localhost:8787/api
npm run test:scenarios        # Excel'dagi 19 ta test ssenariysi
npm run typecheck
```

Frontend bilan birga: ildizda `.env.local` ga `VITE_USE_MOCK=false` yozing va `npm run dev` —
Vite `/api` ni `localhost:8787` ga uzatadi.

Seed hisoblari: `ustoz1` … `ustoz4` (parol `SEED_PASSWORD`, standart `123456`), `ustoz1` — mas'ul shaxs; `direktor` — test filial direktori.
Rahbariyat: `ADMIN_LOGIN` / `ADMIN_PASSWORD`.

## Tuzilma

```
src/
  index.ts     — server + bot ishga tushadi
  config.ts    — .env sozlamalari
  db.ts        — SQLite sxema (Excel varaqlariga mos jadvallar), tranzaksiya
  repo.ts      — qatorlar -> frontend JSON shakli (../src/types.ts), sozlamalar
  logic.ts     — ASOSIY MANTIQ: nomzod topish, ariza, takliflar, tanlash, hisobot
  routes.ts    — HTTP API (docs/api.md shartnomasi)
  auth.ts      — tokenlar (HMAC), bcrypt, Telegram initData tekshiruvi
  bot.ts       — Telegram bot: takliflar (Qabul qilaman/Rad etaman tugmalari), mas'ulga xabarlar
  notify.ts    — mantiq -> bot hodisalari (bot bo'lmasa — jim)
  telegramLink.ts — Telegram'ni bog'lash havolalari (t.me/bot?start=link_<kod>)
  tgRegister.ts — ro'yxat qoidalari: ism/telefon tekshiruvi, fanlar ro'yxati, avtomatik login, telefon bo'yicha bog'lash, tasdiq/parol
  botRegister.ts — bot chatidagi ro'yxat suhbati (savollar, tugmalar, bannerlar)
  davomat.ts   — davomat tizimi (Xodim Plus API) klienti, faqat o'qish
  davomatSync.ts — davomatdan filiallar sinxroni va xodimlarni o'qituvchi sifatida olish
  excel.ts     — .xlsx o'qish
  importer.ts  — Excel -> baza (seed va admin import)
scripts/
  seed.ts       — bazani Excel'dan to'ldirish
  scenarios.ts  — "Test ssenariylari" varag'i bo'yicha tekshiruv
  davomat-check.ts — davomat integratsiyasi tekshiruvi (ishlab turgan server + davomat API)
```

## Telegram bot

Joriy bot: **@mudarris_orinbosar_bot** (token `.env` da).

1. @BotFather → `/newbot` → tokenni `.env` dagi `BOT_TOKEN` ga yozing.
2. Frontend HTTPS manzilini (masalan Vercel) `WEBAPP_URL` ga yozing. Backend ham HTTPS'da bo'lishi va
   frontend `VITE_API_URL` shu manzilga qarashi kerak.
3. Ixtiyoriy: BotFather → `/newapp` bilan Mini App oching va `MINIAPP_LINK=https://t.me/<bot>/<app>` yozing —
   shunda bot tugmalari kerakli sahifani ochadi (`startapp`).
4. Ustoz Mini App ichida login/parol bilan bir marta kirsa, Telegram akkaunti bog'lanadi; keyingi safar parolsiz kiradi
   va bot xabarlari unga keladi.
5. Yangi xodimlar bot CHATINING o'zida ro'yxatdan o'tadi (`botRegister.ts`): `/start` yoki `/royxat` -> bot savol beradi
   (ism, telefon, muassasa, filial, fan). Direktor botda tasdiqlaydi, parol va "Ilova" menyu tugmasi xodim chatiga keladi.
   Bannerlar: `assets/*.png`.

Lokal sinash (Telegram Mini App faqat HTTPS'da ochiladi): `cloudflared tunnel --url http://localhost:5173` ->
chiqqan `https://...trycloudflare.com` manzilini `WEBAPP_URL` ga yozib serverni qayta ishga tushiring
(Vite `/api` ni backendga uzatadi, `allowedHosts` da `.trycloudflare.com` bor). Manzil har ishga tushirishda o'zgaradi.

Bot long-polling bilan ishlaydi (webhook shart emas), shuning uchun server doimiy ishlab turadigan joyda bo'lishi kerak
(VPS, Railway, Render va h.k.). Vercel serverless bunga mos emas.
