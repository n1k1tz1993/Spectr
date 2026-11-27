// Установка как приложения и офлайн: сначала сеть (чтобы приходили обновления), без сети — сохранённая копия.
// Картинки лежат в отдельном кэше, который не стирается при обновлениях; по просьбе страницы скачиваются все сразу (assets.json).
const CACHE = 'spektr-v191', IMG = 'spektr-img';
const FILES = ['./', './index.html', './manifest.webmanifest', './assets.json', './icon-192.png', './icon-512.png', './icon-mask.png', './icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== IMG).map(k => caches.delete(k))))); self.clients.claim(); });
const bucket = u => new URL(u).pathname.includes('/img/') ? IMG : CACHE;
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(bucket(e.request.url)).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
// докачка всех картинок для игры без интернета; прогресс отправляется странице
let busy = null;
const tell = m => self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage(m)));
async function precache() {
  const list = await (await fetch('./assets.json', { cache: 'no-cache' })).json(), c = await caches.open(IMG);
  const have = new Set((await c.keys()).map(r => new URL(r.url).pathname));
  const need = list.filter(u => !have.has(new URL(u, self.registration.scope).pathname));
  let done = list.length - need.length; tell({ t: 'pc', done, total: list.length });
  const work = async () => { while (need.length) { const u = need.shift(); try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (e) {} done++; if (done % 20 === 0 || !need.length) tell({ t: 'pc', done, total: list.length }); } };
  await Promise.all([work(), work(), work(), work(), work(), work()]);
  tell({ t: 'pc', done, total: list.length });
}
self.addEventListener('message', e => { if (e.data === 'precache') { busy = busy || precache().finally(() => { busy = null; }); e.waitUntil(busy); } });
