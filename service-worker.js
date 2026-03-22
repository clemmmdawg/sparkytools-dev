/**
 * @file service-worker.js
 * @description SparkyTools PWA service worker
 *
 * Strategy: cache-first for all app assets (works fully offline after first visit).
 * Google Fonts uses stale-while-revalidate so the font is always available offline
 * but quietly refreshed when the network is present.
 *
 * ── Updating the app ──────────────────────────────────────────────────────────
 * Bump CACHE_VERSION whenever you deploy new files. The old cache will be deleted
 * on the next activation, and users will get fresh assets on their next page load.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CACHE_VERSION   = 'sparkytools-v1.1.0';
const FONTS_CACHE     = 'sparkytools-fonts-v1';

/**
 * All app shell assets to pre-cache on install.
 * Every file the app needs to run offline must be listed here.
 */
const APP_ASSETS = [
  '/index.html',

  // Styles
  '/src/css/base.css',
  '/src/css/ampacity.css',
  '/src/css/box-fill.css',
  '/src/css/conduit-fill.css',
  '/src/css/ohms-law.css',
  '/src/css/panel-schedule.css',
  '/src/css/pull-box.css',
  '/src/css/service-load.css',
  '/src/css/transformer.css',

  // Core JS
  '/src/js/app.js',
  '/src/js/data-loader.js',

  // Calculators
  '/src/js/calculators/ampacity.js',
  '/src/js/calculators/box-fill.js',
  '/src/js/calculators/conduit-fill.js',
  '/src/js/calculators/ohms-law.js',
  '/src/js/calculators/panel-schedule.js',
  '/src/js/calculators/pull-box.js',
  '/src/js/calculators/service-load.js',
  '/src/js/calculators/transformer.js',
  '/src/js/calculators/voltage-drop.js',

  // UI modules
  '/src/js/ui/easter-eggs.js',
  '/src/js/ui/navigation.js',
  '/src/js/ui/theme.js',

  // Utilities
  '/src/js/utils/formatting.js',

  // PWA assets
  '/pwa/manifest.json',
  '/img/bolt.png',
];

// ── Install ────────────────────────────────────────────────────────────────────
// Cache each asset individually so a single fetch failure (e.g. a 404 on a
// preview host) doesn't abort the entire installation.

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache =>
        Promise.allSettled(
          APP_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`SW: failed to cache ${url}:`, err);
              return { failed: url };
            })
          )
        )
      )
      .then(results => {
        const failed = results.filter(r => r.value?.failed);
        if (failed.length > 0) {
          console.error(`SW: ${failed.length} asset(s) failed to cache — app may not work fully offline:`,
            failed.map(r => r.value.failed));
        }
        return self.skipWaiting();
      })
  );
});

// ── Activate ───────────────────────────────────────────────────────────────────
// Delete every cache that isn't the current version.
// self.clients.claim() makes the new SW take control of already-open tabs.

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION && key !== FONTS_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Google Fonts — stale-while-revalidate
  // Serve from cache immediately; refresh cache in background when online
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS_CACHE));
    return;
  }

  // Everything else — cache-first, fall back to network
  event.respondWith(cacheFirst(request));
});

// ── Strategy helpers ───────────────────────────────────────────────────────────

/**
 * Cache-first: return the cached response immediately if available.
 * On a cache miss, fetch from network, cache the response, then return it.
 * Falls back gracefully if the network is also unavailable.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Only cache valid, same-origin responses
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network unavailable and no cache entry — return a minimal offline fallback
    return new Response(
      '<h1>SparkyTools is offline</h1><p>Please reload once connected.</p>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Stale-while-revalidate: return the cached version immediately, then
 * fetch a fresh copy in the background and update the cache for next time.
 * Used for Google Fonts so the UI is never blocked waiting for a font fetch.
 *
 * @param {Request} request
 * @param {string} cacheName
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Kick off background refresh (don't await it)
  const networkFetch = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null); // Silently ignore network errors for fonts

  return cached ?? await networkFetch;
}