// Guarda a "casca" do app para abrir mesmo com internet ruim.
// Nunca guarda chamadas da API nem endereços com texto compartilhado (privacidade).
const VERSAO = 'confere-v1';
const ARQUIVOS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'config.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && !url.search) {
          const copia = res.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./'))),
  );
});
