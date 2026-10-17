const SHELL = 'watchit-shell';
const PAGE = '/';
const API_PREFIX = '/api/';
const ASSET_PREFIX = '/assets/';
const STATIC_PATHS = ['/manifest.webmanifest', '/favicon.svg'];
const STATIC_PREFIXES = ['/icons/', '/pwa/'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== SHELL) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith(API_PREFIX)) return;
  if (request.mode === 'navigate') return event.respondWith(page(request, event));
  if (url.pathname.startsWith(ASSET_PREFIX)) return event.respondWith(hashed(request));
  if (STATIC_PATHS.includes(url.pathname) || STATIC_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) return event.respondWith(revalidated(request, event));
});

async function page(request, event) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      event.waitUntil(remember(cache, response.clone()));
    }
    return response;
  } catch (error) {
    const cached = await cache.match(PAGE);
    if (cached) return cached;
    throw error;
  }
}

async function hashed(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function revalidated(request, event) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(async response => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  if (!cached) return fresh;
  event.waitUntil(fresh.catch(() => undefined));
  return cached;
}

async function remember(cache, response) {
  const previous = await cache.match(PAGE);
  if (previous && (await previous.text()) !== (await response.clone().text())) await dropAssets(cache);
  await cache.put(PAGE, response);
}

async function dropAssets(cache) {
  for (const key of await cache.keys()) {
    if (new URL(key.url).pathname.startsWith(ASSET_PREFIX)) await cache.delete(key);
  }
}
