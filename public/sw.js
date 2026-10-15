// Service worker do DRAP Pecuária: guarda o app no aparelho para abrir sem
// sinal no curral. Diferente do DRAP Fazenda (que é só instalável), aqui os
// dados já vivem no aparelho, então o cache do app fecha o ciclo offline.
//
// Estratégia: navegação = rede primeiro com queda para o cache;
// estáticos (_next/static, fontes, ícones) = cache primeiro.

const VERSAO = 'drap-pecuaria-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSAO).then((c) => c.addAll(['/', '/manifest.webmanifest'])).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((resp) => {
        if (resp.ok && (url.pathname.startsWith('/_next/') || /\.(svg|png|woff2?|js|css|txt)$/.test(url.pathname))) {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return resp;
      });
    }),
  );
});
