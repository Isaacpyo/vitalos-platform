import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { REQUEST_ID_HEADER, correlationId } from "@vitalos/observability";
import { goneResponse, isGone } from "./src/features/redirects/gone";

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
 * Retired paths (`status: 410` rules in the redirect map, ADR-018) answer 410 Gone here; 301/308
 * redirects are applied earlier by `next.config.ts`.
 */
export function proxy(request: NextRequest) {
  const requestId = correlationId(request.headers);

  if (isGone(request.nextUrl.pathname)) {
    const gone = goneResponse();
    gone.headers.set(REQUEST_ID_HEADER, requestId);
    return gone;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
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
