// 숙소 게임 — 앱 셸 + 폰트 캐시 (숙소 와이파이가 불안정해도 앱이 제대로 열리게)
const SHELL_CACHE = 'party-shell-v3';
const ASSET_CACHE = 'party-asset-v3';
const KEEP = [SHELL_CACHE, ASSET_CACHE];
const SHELL = ['./', './index.html', './manifest.json', './icon.svg',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

// 캐시-우선으로 붙잡아 둘 외부 호스트 (폰트만. Firebase는 절대 캐시하지 않음)
const ASSET_HOSTS = ['cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // ── 폰트 등 외부 정적 자산: 캐시 우선 (한 번 받으면 오프라인에서도 유지)
  if (ASSET_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // ── Firebase 등 그 밖의 외부 요청: 손대지 않음 (실시간 동기화 방해 금지)
  if (url.origin !== location.origin) return;

  // ── 앱 셸: 네트워크 우선 + 캐시 폴백 (배포 즉시 반영 + 오프라인 동작)
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
