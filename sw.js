/* ══════════════════════════════════════════════════════════════
   Pendragon GM's Binder — Service Worker
   Caches the offline fallback page so it's available when the
   server is unreachable (power off, network loss, etc.).
══════════════════════════════════════════════════════════════ */

const CACHE_NAME  = 'pendragon-offline-v23';
const OFFLINE_URL = '/offline.html';

// On install: pre-cache the offline page immediately.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

// On activate: take control of all open clients immediately,
// and clean up any old cache versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// On fetch: for navigation requests (page loads), if the network
// fails return the cached offline page instead of a browser error.
// All other requests (API, assets) pass through normally.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL)
    )
  );
});
