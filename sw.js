/**
 * ============================================================
 * SERVICE WORKER — app-shell caching only. This is NOT where
 * offline data logic lives (see js/core/offline.js for that) —
 * this file's only job is making sure the HTML/CSS/JS/CDN
 * library files are still available with no connection.
 *
 * Bump CACHE_VERSION any time you deploy changed files, or
 * browsers may keep serving the old cached versions.
 * ============================================================
 */

const CACHE_VERSION = 'cams-cache-v4';

const PRECACHE_URLS = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './dashboard.html',
  './scanner.html',
  './participants.html',
  './reports.html',
  './settings.html',
  './materials.html',
  './schedule.html',
  './hymns.html',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/responsive.css',
  './js/core/config.js',
  './js/core/api.js',
  './js/core/auth.js',
  './js/core/nav.js',
  './js/core/toast.js',
  './js/core/modal.js',
  './js/core/utils.js',
  './js/core/theme.js',
  './js/core/offline.js',
  './js/core/biometric.js',
  './js/modules/login.js',
  './js/modules/register.js',
  './js/modules/dashboard.js',
  './js/modules/scanner.js',
  './js/modules/participants.js',
  './js/modules/reports.js',
  './js/modules/settings.js',
  './js/modules/materials.js',
  './js/modules/schedule.js',
  './js/modules/hymns.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => { /* a missing file shouldn't block install — pages still work online */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept non-GET requests, and never cache calls to the live
  // Apps Script API — that data must always be fetched fresh (or fail
  // outright so the app's own offline-queue logic can take over).
  if (request.method !== 'GET') return;
  if (request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      // Serve the cached copy immediately if we have one (fast + works
      // offline), refreshing it in the background when online.
      return cached || networkFetch;
    })
  );
});
