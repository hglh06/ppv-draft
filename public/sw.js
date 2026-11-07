// Service worker de la PPV Draft League: la pagina siempre se pide a la red primero (para ver lo mas nuevo)
// y se guarda una copia para abrirla sin conexion; logos, sprites y fuentes se sirven desde cache.
const V = "ppv-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "logos/logo-ppv-white.png", "meta/favicon.png", "meta/icon-192.png", "media/hero-poster.jpg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put("index.html", cp)); return res; }).catch(() => caches.match("index.html")));
    return;
  }
  if (u.pathname.endsWith(".mp4")) return; // el video no se guarda
  const same = u.origin === location.origin, ext = /(^|\.)raw\.githubusercontent\.com$|^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!same && !ext) return;
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res.ok || res.type === "opaque") { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
