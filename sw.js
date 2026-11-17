// Service Worker: يخزن هيكل التطبيق فقط. بيانات Firebase دائماً من الشبكة.
const CACHE = 'khusoomati-v4';
const SHELL = [
  './', './index.html', './styles.css?v=7', './script.js?v=18',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Firebase/CDN/صور المتاجر: بدون تدخل
  if (url.pathname.endsWith('/admin.html') || url.pathname.endsWith('/admin.js')) return; // لوحة الأدمن لا تُخزن

  // الصفحات: الشبكة أولاً، وإن فشلت (بدون إنترنت) من الكاش
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // باقي الملفات: من الكاش مع تحديثها بالخلفية
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
