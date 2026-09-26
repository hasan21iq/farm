// عامل الخدمة: يخزّن ملفات اللعبة لتعمل بدون إنترنت
const CACHE = 'animal-farm-v2';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/config.js', './js/game.js', './js/render.js', './js/ui.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// الشبكة أولاً (لتصل التحديثات)، والذاكرة المؤقتة عند انقطاع الإنترنت
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
