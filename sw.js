// Jarvis — service worker
// Estrategia: "la red primero, el cache como respaldo". Siempre intenta traer
// la versión más nueva; si no hay señal, sirve la copia guardada. Así la app
// abre sin internet y a la vez nunca queda congelada en una versión vieja.
const CACHE = "jarvis-2553d42019";
const ESENCIALES = [
  "./", "./index.html", "./manifest.json",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/lucide@1.23.0/dist/umd/lucide.js",
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore-compat.js"
];

// El trafico de la sincronizacion NO pasa por el cache: Firestore mantiene una
// conexion viva y guardarla rompe el tiempo real. Firebase ya trae su propio
// modo sin conexion, asi que no necesita ayuda de aca.
const SIN_CACHE = /(?:googleapis\.com|firebaseio\.com|firebaseapp\.com|google-analytics\.com|googletagmanager\.com)/;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ESENCIALES.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (SIN_CACHE.test(url.hostname)) return;   // la sincronizacion va directo a la red

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Solo se guardan respuestas sanas y completas.
        if (res && res.status === 200 && res.type !== "opaque") {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => {
        if (r) return r;
        // Devolver el index.html en lugar de un .js roto solo tiene sentido
        // cuando lo que se pedia era una pagina.
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      }))
  );
});
