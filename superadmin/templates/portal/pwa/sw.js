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
 *
 * Push notifications (ADR-056, Phase 2) store nothing either. A push carries a generic line ("A new question needs
 * your answer"), a tag and a same-origin path; the worker shows it and, on a click, opens that path only if it is
 * inside the portal scope (otherwise the portal home). Opening it goes through the network like any navigation.
 */
"use strict";

const VERSION = {{ version }};
const CACHE = "vitalos-portal-static-" + VERSION;
const STATIC_PREFIX = {{ static_prefix }};
const OFFLINE_URL = {{ offline_url }};
const PRECACHE = {{ precache }};
// ManifestStaticFilesStorage names: name.<12 hex>.ext
const HASHED = /\.[0-9a-f]{12}\.[A-Za-z0-9]+$/;
const ICON = {{ icon }};
const BADGE = {{ badge }};
const PUSH_KEY = {{ push_key }}; // the server's public key; empty while push is off
const PUSH_RENEW_URL = {{ push_renew_url }};
const DEFAULT_TITLE = "Vitalos";
const DEFAULT_BODY = "There's something new in your portal.";

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

// --- Push notifications ---------------------------------------------------------------------------------------

// The only place a notification may send the customer: a same-origin path inside the portal scope. Anything else
// (another origin, a protocol-relative or javascript: URL, a path outside the scope) opens the portal home.
function safeTarget(value) {
  const scope = new URL(self.registration.scope);
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    try {
      const url = new URL(value, scope);
      if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) return url.href;
    } catch (error) {
      // fall through to the portal home
    }
  }
  return scope.href;
}

function text(value, fallback, limit) {
  return typeof value === "string" && value.trim() ? value.slice(0, limit) : fallback;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }
  // Every push shows a notification (userVisibleOnly), even one that could not be read.
  const tag = text(data.tag, "vitalos", 64);
  event.waitUntil(
    self.registration.showNotification(text(data.title, DEFAULT_TITLE, 80), {
      body: text(data.body, DEFAULT_BODY, 200),
      icon: ICON,
      badge: BADGE,
      tag: tag,
      renotify: true,
      data: { url: safeTarget(data.url) },
    })
  );
});

// Focus a portal window already showing the target, else take an open portal window there, else open a new one.
async function openTarget(target) {
  const scope = self.registration.scope;
  const windows = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).filter((client) =>
    client.url.startsWith(scope)
  );
  for (const client of windows) {
    if (client.url === target && "focus" in client) return client.focus();
  }
  for (const client of windows) {
    if ("navigate" in client) {
      try {
        const navigated = await client.navigate(target);
        if (navigated) return navigated.focus();
      } catch (error) {
        // An uncontrolled window cannot be navigated from here; open a new one instead.
      }
    }
  }
  return self.clients.openWindow(target);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(openTarget(safeTarget(data.url)));
});

function toBytes(base64url) {
  const padded = (base64url + "===".slice((base64url.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function toBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// The browser replaced the subscription. Best effort: subscribe again if it did not, then tell the server, proving
// the request with the old subscription's secret (a worker has no session or CSRF token). If the old subscription
// is unknown, the Account page re-registers this device on the next visit.
async function renewSubscription(event) {
  const old = event.oldSubscription || null;
  let fresh = event.newSubscription || null;
  if (!fresh) {
    if (!PUSH_KEY) return;
    fresh = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(PUSH_KEY),
    });
  }
  if (!old || !fresh || old.endpoint === fresh.endpoint || typeof old.getKey !== "function") return;
  const oldAuth = old.getKey("auth");
  if (!oldAuth) return;
  await fetch(PUSH_RENEW_URL, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_endpoint: old.endpoint, old_auth: toBase64Url(oldAuth), subscription: fresh.toJSON() }),
  });
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(renewSubscription(event).catch(() => {}));
});
{% endautoescape %}