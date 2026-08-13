// 숙소 게임 — 앱 셸 캐시 (숙소 와이파이가 불안정해도 앱 자체는 열리게)
const CACHE = 'party-games-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Firebase / 외부 요청은 항상 네트워크
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  // 앱 셸은 network-first + 캐시 폴백 (배포 즉시 반영 + 오프라인 동작)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
