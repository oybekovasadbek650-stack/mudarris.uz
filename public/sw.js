// Service worker — ilovani telefonga o'rnatish uchun (PWA).
// Ataylab kesh QILMAYDI: har doim yangi versiya va jonli ma'lumot (eski sahifa qolib ketmasin).
// Faqat internet yo'q paytda sahifa o'rniga "Internet yo'q" ekranini ko'rsatadi.
const OFFLINE = '/offline.html'
const CACHE = 'mudarris-offline-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/icons/icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  // Faqat sahifa ochilishi (navigatsiya); API, rasmlar va boshqalar — brauzerning o'zi
  if (e.request.mode !== 'navigate') return
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)))
})
