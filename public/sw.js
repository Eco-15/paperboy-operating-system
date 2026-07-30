// Paperboy OS mobile service worker (handwritten, deliberately small).
// The phone app is the Investment CRM and nothing else, so there is no API
// caching here — deal data must never be served stale from disk.
// Strategy:
//   • /_next/static/* and /icons/*  → cache-first (immutable/build-hashed)
//   • navigations to /m*            → network-first, cached '/m' shell fallback
// Everything else passes through untouched. Same-origin GET only.
const CACHE = "pbm-v2";
const SHELL = "/m";

// A signed-out request for /m is redirected to /login by middleware. Caching
// THAT under the /m key would serve the login page as the offline shell
// forever, so every write of the shell checks the response is really /m.
function isShell(res) {
  return !!res && res.ok && !res.redirected;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        const res = await fetch(SHELL, { credentials: "same-origin" });
        if (isShell(res)) await cache.put(SHELL, res.clone());
      } catch (e) {
        /* precache is best-effort */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      } catch (e) {
        /* noop */
      }
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  try {
    if (res && res.ok) await cache.put(request, res.clone());
  } catch (e) {
    /* quota/opaque — serve the network response anyway */
  }
  return res;
}

async function shellFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (isShell(res)) {
      try {
        await cache.put(SHELL, res.clone());
      } catch (e) {
        /* noop */
      }
    }
    return res;
  } catch (e) {
    const hit = await cache.match(SHELL);
    if (hit) return hit;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate" && (url.pathname === "/m" || url.pathname.startsWith("/m/"))) {
    event.respondWith(shellFirst(request));
  }
});
