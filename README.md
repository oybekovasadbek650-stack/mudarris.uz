# O'rinbosar tizimi — frontend

Telegram Mini App (o'qituvchi va mas'ul shaxs) + Rahbariyat paneli (kompyuter).

```
npm install
npm run dev
```

- http://localhost:5173/app — Mini App (telefon ko'rinishi)
- http://localhost:5173/admin — Rahbariyat paneli

- http://localhost:5173/login — o'qituvchi kirishi, /register — ro'yxatdan o'tish, /admin/login — rahbariyat

Standart holatda **soxta ma'lumotlar** bilan ishlaydi. Demo hisoblar: o'qituvchi `aziza` / `123456`, tasdiq kutayotgan `kamola` / `123456`, rahbariyat `admin` / `admin123`. Haqiqiy backendga ulash: `.env.example` ni `.env` ga nusxalang va `VITE_USE_MOCK=false`, `VITE_API_URL=...` qiling.

Backend dasturchi uchun: [docs/api.md](docs/api.md)
