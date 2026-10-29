{% autoescape off %}/*
 * Vitalos Client Portal service worker (ADR-056, Phase 1: installable app).
 *
 * PRIVACY RULE, NOT NEGOTIABLE: the portal holds customers' private project data and may be used on shared
 * devices. This worker stores ONLY public static files (same-origin GET under the static prefix) and the public
 * offline page. It never stores a page, an HTMX partial, a file download, an export, a POST or API response, or
 * anything else from the workspace. Because nothing private is ever cached, signing out needs no cache purge.
 *
 *   Navigations (GET): network only. When the network fails, the cached offline page.
 *   Static files: cache-first for content-hashed names (immutable in production); network-first for unhashed
 *                 names (local development), with the cached copy only as the offline fallback.
 *   Everything else, and every other origin: not intercepted, so the browser handles it as if there were no worker.
 */
"use strict";

const VERSION = {{ version }};
const CACHE = "vitalos-portal-static-" + VERSION;
const STATIC_PREFIX = {{ static_prefix }};
const OFFLINE_URL = {{ offline_url }};
const PRECACHE = {{ precache }};
// ManifestStaticFilesStorage names: name.<12 hex>.ext
const HASHED = /\.[0-9a-f]{12}\.[A-Za-z0-9]+$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // No cookies: the offline page and the static files are the same for everyone.
        cache.addAll(PRECACHE.concat([OFFLINE_URL]).map((url) => new Request(url, { cache: "reload", credentials: "omit" })))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // Forms and HTMX actions go straight to the network.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(event));
    return;
  }
  if (url.pathname.startsWith(STATIC_PREFIX)) event.respondWith(staticFile(request, url));
  // Anything else (HTMX partials, downloads, exports, API calls) is deliberately left alone and never cached.
});

async function navigate(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    const offline = await cache.match(OFFLINE_URL, { ignoreVary: true });
    return offline || Response.error();
  }
}

// Keep a copy of a public static file. A full or failing cache must never break the page, so errors are ignored.
function keep(cache, request, response) {
  if (response.status === 200 && response.type === "basic") cache.put(request, response.clone()).catch(() => {});
  return response;
}

async function staticFile(request, url) {
  const cache = await caches.open(CACHE);
  if (HASHED.test(url.pathname)) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    return keep(cache, request, await fetch(request));
  }
  try {
    return keep(cache, request, await fetch(request));
  } catch (error) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    throw error;
  }
}
{% endautoescape %}