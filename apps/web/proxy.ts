import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { REQUEST_ID_HEADER, correlationId } from "@vitalos/observability";
import { contentProxyDecision, unavailableResponse } from "./src/features/content/proxy";
import { UNMATCHED_PATH, isMissingDetailPath } from "./src/features/missing-documents";
import { goneResponse, isGone } from "./src/features/redirects/gone";
import { lowercasePath } from "./src/features/redirects/lowercase";

/**
 * Proxy (formerly middleware). Assigns a correlation id to every request: a well-formed inbound
 * `x-request-id` is kept, anything else is replaced. The id is forwarded to the app (route
 * handlers and Server Components read it with `headers()`) and echoed on the response so support
 * and logs can be matched.
 *
 * Security headers and `X-Robots-Tag` are NOT set here: they come from `next.config.ts`
 * (`src/config/security-headers.ts`) so they also cover static assets and are testable without
 * a running server. No per-request CSP nonce either (ADR-020): a nonce would force dynamic
 * rendering of every page.
 *
 * Retired paths (`status: 410` rules in the redirect map, ADR-018) answer 410 Gone here; 308
 * redirects are applied earlier by `next.config.ts`. A path with capital letters gets a 308 to its
 * lowercase form (docs/seo/URL-RULES.md rule 1).
 *
 * A detail URL with no document behind it is rewritten onto an unmatched path (ADR-027). Next.js
 * server-renders the not-found page for an unmatched URL but not for a `notFound()` thrown by a
 * page, which would leave visitors without JavaScript with a blank 404.
 *
 * Insights and Careers (ADR-040): the proxy asks the internal content lookup about every GET to
 * their pages (Draft Mode requests excepted) and answers what a page cannot: 308 for an old slug,
 * the server-rendered 404 for a missing item or a closed section, and 503 with `Retry-After` when
 * the admin is unreachable and nothing is cached. Any lookup failure passes the request through.
 */
export async function proxy(request: NextRequest) {
  const requestId = correlationId(request.headers);

  const lowercase = lowercasePath(request.nextUrl.pathname);
  if (lowercase !== null) {
    const target = request.nextUrl.clone();
    target.pathname = lowercase;
    const moved = NextResponse.redirect(target, 308);
    moved.headers.set(REQUEST_ID_HEADER, requestId);
    return moved;
  }

  if (isGone(request.nextUrl.pathname)) {
    const gone = goneResponse();
    gone.headers.set(REQUEST_ID_HEADER, requestId);
    return gone;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const { pathname } = request.nextUrl;
  const content = await contentProxyDecision(request);
  if (typeof content === "object") {
    const redirect = NextResponse.redirect(new URL(content.redirect, request.url), 308);
    redirect.headers.set(REQUEST_ID_HEADER, requestId);
    redirect.headers.set("cache-control", "no-store");
    return redirect;
  }
  if (content === "unavailable") return unavailableResponse(requestId);

  const missing =
    content === "missing" ||
    (content === "not-applicable" &&
      request.method === "GET" &&
      (await isMissingDetailPath(pathname)));
  const response = missing
    ? NextResponse.rewrite(new URL(UNMATCHED_PATH, request.url), {
        request: { headers: requestHeaders },
      })
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  // A rewritten 404 must never be cached by an edge or browser: the document may be published
  // moments later (ADR-027).
  if (missing) response.headers.set("cache-control", "no-store");
  return response;
}

export const config = {
  // Skip framework assets and prefetches; pages, API routes and not-found responses all match.
  matcher: [
    {
      // Static asset extensions are skipped; routes such as robots.txt and sitemap.xml still match.
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|css|js|map|woff2?|ttf|otf)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
