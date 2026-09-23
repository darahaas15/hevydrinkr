const CACHE_VERSION = 3;
const STATIC_CACHE = `drinkr-static-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `drinkr-runtime-v${CACHE_VERSION}`;
// Photos and avatars from Supabase Storage, capped so the cache can't grow forever.
const IMAGE_CACHE = 'drinkr-images-v1';
const MAX_CACHED_IMAGES = 300;

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
  const keep = new Set([STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE]);
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

  // Stored photos and avatars → cache-first, so ones already seen load from the
  // phone and still show when the network drops. Every upload gets a unique
  // path, so a cached copy never goes stale.
  if (url.pathname.startsWith('/storage/v1/object/public/images/')) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

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

// ── Photos: cache-first ──────────────────────────
async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  let response;
  try {
    // Fetch with CORS (Storage allows any origin) so the cached copy is a
    // readable response; opaque responses are padded heavily against quota.
    response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  } catch {
    // CORS refused or offline: fall back to the page's own request.
    return fetch(request).catch(() => new Response('Offline', { status: 503 }));
  }
  if (response.ok) {
    // Save in the background; a failed write (quota) must not refetch the photo.
    cache.put(request.url, response.clone()).then(() => trimImageCache(cache)).catch(() => {});
  }
  return response;
}

async function trimImageCache(cache) {
  const keys = await cache.keys(); // oldest first
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_IMAGES))) {
    await cache.delete(key);
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

// ── Notification deep-link routing ───────────────
// Maps a notification's flattened { type, ...data } payload to the in-app path
// it should open. KEEP IN SYNC with getNotificationPath() in
// src/app/(app)/notifications/page.tsx — tapping a push and tapping the same
// notification in the in-app list must land on the same screen for every type.
function notificationPath(data) {
  const type = data.type;

  // Post-related → open the post, scrolling to the comment when there is one.
  if (['like', 'comment', 'reply', 'comment_like', 'mention', 'new_post', 'tag'].includes(type)) {
    if (!data.feedItemId) return '/feed';
    const post = `/feed?post=${data.feedItemId}`;
    return data.commentId ? `${post}&comment=${data.commentId}` : post;
  }

  if (type === 'follow') return data.actorId ? `/profile/${data.actorId}` : '/feed';
  if (type === 'follow_request') return '/profile/requests';
  if (type === 'follow_request_accepted') return data.actorId ? `/profile/${data.actorId}` : '/profile';
  if (type === 'group_join' || type === 'challenge_created') return data.groupId ? `/groups?id=${data.groupId}` : '/feed';
  if (type === 'still_drinking') return '/session';

  return '/feed';
}

// ── Notification click → deep-link ───────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const path = notificationPath(event.notification.data || {});

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
