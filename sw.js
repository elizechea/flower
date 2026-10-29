// Service worker: app shell cache-first, historias stale-while-revalidate.
// Al añadir/quitar ficheros del shell, actualizar SHELL y subir VERSION.
const VERSION = 'terminal-v4';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/base.css', 'css/crt.css',
  'fonts/VT323-Regular.woff2',
  'js/main.js', 'js/router.js',
  'js/ai/llm.js', 'js/ai/prompt.js', 'js/ui/ai-view.js',
  'js/audio/blip.js',
  'js/engine/conditions.js', 'js/engine/engine.js', 'js/engine/validate.js',
  'js/i18n/es.js',
  'js/net/transport.js',
  'js/session/session.js', 'js/session/storage.js',
  'js/ui/menu.js', 'js/ui/terminal.js', 'js/ui/typewriter.js', 'js/ui/views.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'stories/index.json', 'stories/ai/index.json',
  'stories/colonia-kepler-9.json', 'stories/nave-a-la-deriva.json',
  'stories/protocolo-hal-iota.json', 'stories/senal-en-el-vacio.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // cache: 'reload' salta la caché HTTP del navegador (GitHub Pages: max-age=600) para no precachear copias viejas.
      .then((c) => c.addAll(SHELL.map((p) => new Request(new URL(p, self.registration.scope).href, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(e, req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(async (res) => {
    if (res.ok) await cache.put(req, res.clone()).catch(() => {}); // sin cuota: se sirve igual
    return res;
  });
  e.waitUntil(net.catch(() => {})); // que el navegador no mate el SW antes de refrescar la caché
  return hit || net;
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match(new URL('index.html', self.registration.scope).href)),
    );
    return;
  }
  const scoped = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  e.respondWith(scoped.startsWith('stories/') && scoped.endsWith('.json') ? staleWhileRevalidate(e, req) : cacheFirst(req));
});
