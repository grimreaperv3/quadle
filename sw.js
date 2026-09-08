/* Quadle service worker — cache everything on first visit, then run offline.
   Bump CACHE when you change any file, or phones will keep the old copy. */
const CACHE = "quadle-v4";
const FILES = [
  "./","./index.html","./styles.css","./app.js","./manifest.webmanifest",
  "./data/practice-boards.json","./data/daily-boards.json",
  "./icons/icon-192.png","./icons/icon-512.png","./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
