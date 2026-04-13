const CACHE_VERSION = 3;
const STATIC_CACHE = `drinkr-static-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `drinkr-runtime-v${CACHE_VERSION}`;

// App shell — precached on install so the app loads offline
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon.svg',
];

// ── Install ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Cache each URL individually so one failure doesn't block SW activation
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => { /* skip failed precache entry */ })
        )
      )
    )
  );
  self.skipWaiting();
});

// ── Activate — clean old caches ──────────────────
self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch strategies ─────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip non-http (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Supabase / API calls → network-only (don't cache auth or realtime)
  if (url.hostname.includes('supabase')) return;

  // Navigation requests → network-first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }

  // Static assets (JS, CSS, fonts, images) → stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else → network-first with cache fallback
  event.respondWith(networkFirst(request));
});

// ── Navigation: network-first with offline fallback ──
async function networkFirstNav(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}

// ── Assets: stale-while-revalidate ───────────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached immediately, update in background
  return cached || (await fetchPromise) || new Response('Offline', { status: 503 });
}

// ── Generic: network-first ───────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── Helpers ──────────────────────────────────────
function isStaticAsset(url) {
  const ext = url.pathname.split('.').pop();
  return ['js', 'css', 'woff', 'woff2', 'ttf', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'ico'].includes(ext);
}

// ── Push notification handling ───────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Drinkr', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: data.data || {},
    tag: data.tag || 'drinkr-notification',
    renotify: !!data.tag,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Drinkr', options));
});

// ── Notification click → deep-link ───────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let path = '/feed';

  if (data.type === 'like' || data.type === 'comment' || data.type === 'reply' || data.type === 'comment_like' || data.type === 'mention') {
    if (data.feedItemId) {
      path = `/feed?post=${data.feedItemId}`;
      if (data.commentId) path += `&comment=${data.commentId}`;
    }
  } else if (data.type === 'follow' && data.actorId) {
    path = `/profile?user=${data.actorId}`;
  } else if ((data.type === 'group_join' || data.type === 'challenge_created') && data.groupId) {
    path = `/groups?id=${data.groupId}`;
  } else if (data.type === 'still_drinking') {
    path = '/session';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If an app window exists, message it to navigate via Next.js router
      // so the history stack is preserved (back button works).
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.postMessage({ type: 'NAVIGATE', path });
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    })
  );
});
