# ADR 026 Server-rendered 404 for missing documents

Status: Accepted (engineering).

## Context

A request for a document that does not exist (`/solutions/no-such-slug`) was answered with status 404 and `noindex`, but the body was empty: a visitor without JavaScript, and any client that does not run scripts, saw a blank page. Unmatched URLs (`/no-such-route`) were fine.

Investigation (Next.js 16.4.0, development and production builds, both content sources):

- The HTML of a missing-document response is Next.js's error-recovery document, `<html id="__next_error__">` with an empty `<body>`, plus the streamed payload that carries the `NEXT_HTTP_ERROR_FALLBACK;404` error row. The 404 UI is drawn by `HTTPAccessFallbackBoundary` after hydration.
- The cause is that a `notFound()` thrown by a page reaches React's server renderer (Fizz) outside any Suspense boundary. Fizz does not run client error boundaries, so the shell render fails and `app-render` falls back to the empty error shell. This is independent of this repository: it reproduces with a page that only calls `notFound()`, with the root `error.tsx` and `global-error.tsx` removed, with a minimal `next.config` and with a statically generated route.
- It is not caused by Suspense in our code (there is none in the route tree) or by the motion wrappers.
- Wrapping the throw in Suspense does put HTML in the response, but then the status is 200: after the first flush Next.js cannot change it, and in the non-Cache-Components render path nothing sets it for errors inside Suspense. A soft 404 is not acceptable here (ADR-022, protocol tests).
- Next.js's own guidance for a real 404 plus server-rendered content is to decide in the proxy and rewrite to a not-found route (`docs/01-app/03-api-reference/03-file-conventions/loading.md`, "Status codes"). Unmatched URLs are rendered normally, with the root `not-found.tsx` inside the site shell.
- `dynamicParams = false` would give the same result but makes documents published after a build unreachable until the next deploy and blocks Draft Mode previews of unpublished documents. Cache Components would remove the limitation but is a site-wide restructuring.

## Decision

1. The proxy (`apps/web/proxy.ts`) asks `src/features/missing-documents` whether a request for a detail URL has a document behind it. If the published content certainly has none, it rewrites the request to a path no route matches (`/__vitalos-missing-document__`). Next.js then answers 404 with the server-rendered root not-found page (header, 404 content, footer) and the browser URL is unchanged.
2. The decision uses `ContentSource.listParams` of the published source, the list `generateStaticParams` already uses, cached in memory per kind for 30 seconds with concurrent reads shared. A cached "missing" verdict is never trusted alone: if the entry is older than 3 seconds it is confirmed by a fresh read first (one shared read per kind per 3 seconds, so random slugs cannot multiply reads). Each read is bounded by a 1.5 second timeout that fails open; a failed or timed-out read is remembered for 5 seconds (the stale list is served meanwhile) so a slow source cannot stall every detail request. A successful `/api/revalidate` call drops the lists on the instance that handled it. The rewritten 404 carries `Cache-Control: no-store`, so no edge or browser caches it.
3. It fails open. Any read failure, any path that is not a detail route, Draft Mode requests (`__prerender_bypass` cookie) and non-GET requests are passed through untouched, and every page keeps its own `notFound()`. Conditions only the page can decide (closed publication gates, case studies without verified evidence, lab assets without limitations) therefore still render the client-drawn 404 until a later change.
4. The route knowledge (twelve detail families and their `listParams` keys) is pure code in `detail-routes.ts`, unit tested; the proxy contains no content rules.

## Consequences

- No JavaScript is needed to read the 404 page for a missing document; `tests/end-to-end/not-found.nojs.spec.ts` asserts it, with status, header, footer, one `main` and `noindex`, for every dynamic route family.
- Remaining window: a document published within the last 3 seconds can answer 404 on an instance whose cached list is younger than that (the response is `no-store`, so the next request recovers). After 3 seconds every "missing" is confirmed by a fresh read, bounded by the timeout.
- With Sanity the proxy adds up to one list read per kind per instance per 30 seconds. This could not be exercised against a real Sanity project (none is approved, ADR-005); the failure mode is the previous behaviour.
- Revisit if the site adopts Cache Components: the Suspense-based status handling there makes the proxy rewrite unnecessary.
