// Paperboy OS mobile service worker (handwritten, deliberately small).
// The phone app is the Investment CRM and nothing else, so there is no API
// caching here — deal data must never be served stale from disk.
// Strategy:
//   • /_next/static/* and /icons/*  → cache-first (immutable/build-hashed)
//   • navigations to /m*            → network-first, cached '/m' shell fallback
//   • push + notificationclick      → lock-screen alerts for new applications
// Everything else passes through untouched. Same-origin GET only.
const CACHE = "pbm-v3";
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

// ── Web Push ───────────────────────────────────────────────────────────────
// Lock-screen alerts for new brand applications. The payload is JSON produced
// by lib/push/send.ts: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Paperboy";
  // showNotification MUST be awaited inside waitUntil — iOS revokes the push
  // permission of a service worker that receives a push without displaying one.
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "paperboy",
      renotify: true,
      data: { url: data.url || "/m" },
    }),
  );
});

// Tapping the notification focuses the already-open app if there is one, rather
// than spawning a second copy.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/m";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (client.url.includes("/m")) {
          await client.focus();
          if ("navigate" in client && url !== "/m") await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

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
