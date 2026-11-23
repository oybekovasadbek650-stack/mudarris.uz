import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Ishlab chiqishda /api so'rovlari backendga (server/, port 8787) uzatiladi
  server: {
    proxy: { '/api': 'http://localhost:8787' },
    // Windows'da (yo'lda "R&D" bor) fayl o'zgarishi hodisalari ba'zan yo'qoladi va Vite eski modulni
    // beradi (masalan "X is not defined"). Polling bilan kuzatish buni yo'qotadi.
    watch: { usePolling: true, interval: 300 },
    // Telegram Mini App'ni lokal sinash: vaqtinchalik HTTPS tunnel (cloudflared) manzili
    allowedHosts: ['.trycloudflare.com'],
  },
})
