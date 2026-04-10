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

  // Skip non-GET requests — let the browser handle them normally
  if (request.method !== 'GET') return;

  // Skip Vite dev server assets to avoid caching HMR/dev URLs
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('__vite') ||
    url.pathname.includes('node_modules')
  ) return;

  // Same-origin page/navigation — network-first, fallback to cached app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, CACHE_NAME).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match('/index.html')) ||
          (await cache.match('/')) ||
          new Response('Offline — please check your connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          })
        );
      }),
    );
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
    // Propagate rejection so navigate handler can fall back to /index.html
    throw new Error('Network unavailable and no cache entry found');
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
    // Return a proper error response — an empty 408 would silently break JS/CSS modules
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fire-and-forget network update
  fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
    })
    .catch(() => {});

  // Return cached copy immediately, or attempt a fresh fetch as fallback.
  // If offline and nothing is cached, return a 503 instead of rejecting.
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function networkOnly(request) {
  return fetch(request);
}
