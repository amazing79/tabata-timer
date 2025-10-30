const CACHE_NAME = 'tabata-cache-v3'; // <- RECORDAR CAMBIAR VERSION PARA INDICAR ACTUALIZACIONES
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/styles.css',
    './assets/js/app.js',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/sounds/fondo.mp3',
];

// Instalación: cachea archivos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // fuerza activación inmediata
});

// Activación: limpia caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // toma control inmediato de las páginas
});

// Estrategia: network first para HTML/JS, cache first para otros
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Siempre buscar primero en la red para index.html, app.js y css
  if (
      url.pathname.endsWith('index.html') 
      || url.pathname.endsWith('app.js')
      || url.pathname.endsWith('styles.css') 
    ) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  return cached || fetch(req);
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return cached || Response.error();
  }
}
