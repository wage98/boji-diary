// 薄肌日记 v7.10 · Service Worker
// 离线缓存 app shell，让“桌面常驻桌宠”在断网/二次打开时也能秒开
const CACHE = 'boji-v8-0-20260928';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './assets/icon.svg',
  './assets/nahida-card.webp',
  './assets/nahida-icon.webp',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 页面类请求：网络优先（保证手机上打开就是最新版本），断网回落离线缓存；非 GET 直接放行
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isPage = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
        return res;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }
  // 静态资源：缓存优先 + 后台更新
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, cp));
        }
        return res;
      }).catch(() => null);
      return cached || net;
    })
  );
});
