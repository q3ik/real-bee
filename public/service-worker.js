/**
 * Real Bee Service Worker
 *
 * Caching strategy:
 *   - App shell (index.html, JS, CSS): Cache-first with network update
 *   - Word data (public/data/words/*.json): Stale-while-revalidate
 *   - Fonts / images: Cache-first
 *   - API calls (/api/*): Network-first, fallback to cache
 *   - Everything else: Network-only
 *
 * Offline behavior:
 *   - If the app shell is cached, the app loads offline.
 *   - Word data is served from cache (stale) while a background fetch updates it.
 *   - API calls (TTS/STT) fail gracefully — the app falls back to Web Speech API.
 */

const CACHE_NAME = 'real-bee-v1';
const DYNAMIC_CACHE = 'real-bee-dynamic-v1';

// Assets to precache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ---------------------------------------------------------------------------
// Install — precache app shell
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — clean old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — routing by request type
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Same-origin page/navigation — network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // API calls (TTS/STT/hint) — network-first, no fallback cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Static JS/CSS bundles — cache-first
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.wasm')
  ) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Word data JSON — stale-while-revalidate
  if (url.pathname.startsWith('/data/words/')) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  // Icons / images — cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    request.destination === 'image'
  ) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Fonts — cache-first
  if (request.destination === 'font') {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Default: network-only
  event.respondWith(networkOnly(request));
});

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline — please check your connection.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fire-and-forget network update
  fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
  }).catch(() => {});

  return cached || fetch(request);
}

async function networkOnly(request) {
  return fetch(request);
}
