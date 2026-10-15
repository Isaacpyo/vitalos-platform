import "server-only";
import { getEnv } from "@vitalos/config";
import { clientIpFromHeaders } from "@vitalos/security/rate-limit";
import type { DeployEnv } from "@vitalos/config";
import { LOOKUP_AUTH_HEADER, LOOKUP_CLIENT_IP_HEADER, signLookup } from "./lookup/auth";
import { VerdictSchema, createProxyLookup, sharedProxyLookup } from "./lookup/proxy-lookup";
import { isContentLookupPath } from "./lookup/verdict";

/**
 * The proxy's view of Insights and Careers paths (ADR-036). `proxy.ts` calls
 * `contentProxyDecision` for every GET and acts on the answer:
 *
 * - `not-applicable`: not an Insights or Careers page; the proxy carries on as before;
 * - `pass`: let the page render (verdict ok, a Draft Mode request, or the lookup failed);
 * - `missing`: rewrite to the server-rendered 404;
 * - `unavailable`: 503 with `Retry-After`;
 * - `{ redirect }`: 308 to the current slug.
 */

export type ContentProxyResult =
  "not-applicable" | "pass" | "missing" | "unavailable" | { redirect: string };

/** The cookie Next.js sets for Draft Mode. Draft requests always reach the page. */
export const DRAFT_MODE_COOKIE = "__prerender_bypass";

interface ProxyRequestLike {
  method: string;
  url: string;
  nextUrl: { pathname: string; origin: string; host: string };
  cookies: { has(name: string): boolean };
  headers: { get(name: string): string | null };
}

function contentConfig(): { readSecret: string; siteUrl: string; deployEnv: DeployEnv } | null {
  try {
    const env = getEnv();
    const { apiBaseUrl, readKey } = env.content;
    return apiBaseUrl && readKey
      ? { readSecret: readKey.secret, siteUrl: env.siteUrl, deployEnv: env.deployEnv }
      : null;
  } catch {
    // Invalid configuration fails the build; at runtime the proxy must never throw.
    return null;
  }
}

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Where the proxy sends its lookup: this deployment. The request's own origin is used only when
 * its host is the site or the Vercel deployment URL, or, for local runs only, a local host, so a
 * forged `Host` header cannot send the signed lookup header elsewhere.
 */
export function lookupOrigin(requestOrigin: string, siteUrl: string, deployEnv: DeployEnv): string {
  const url = new URL(requestOrigin);
  const allowed = new Set([new URL(siteUrl).host, process.env["VERCEL_URL"] ?? ""]);
  if (allowed.has(url.host)) return url.origin;
  return deployEnv === "local" && localHosts.has(url.hostname) ? url.origin : siteUrl;
}

function proxyLookup(readSecret: string, origin: string) {
  return sharedProxyLookup(() =>
    createProxyLookup({
      fetchVerdict: async (path, signal, clientIp) => {
        const url = new URL("/api/content/lookup", origin);
        url.searchParams.set("path", path);
        const response = await fetch(url, {
          headers: {
            [LOOKUP_AUTH_HEADER]: signLookup(readSecret, { path, clientIp }),
            [LOOKUP_CLIENT_IP_HEADER]: clientIp,
          },
          cache: "no-store",
          redirect: "manual",
          signal,
        });
        if (!response.ok) throw new Error(`lookup ${response.status}`);
        return VerdictSchema.parse(await response.json());
      },
    }),
  );
}

export async function contentProxyDecision(request: ProxyRequestLike): Promise<ContentProxyResult> {
  const { pathname } = request.nextUrl;
  if (request.method !== "GET" || !isContentLookupPath(pathname)) return "not-applicable";
  const config = contentConfig();
  // Not configured: both sections are closed (server-rendered 404, ADR-035 4).
  if (!config) return "missing";
  if (request.cookies.has(DRAFT_MODE_COOKIE)) return "pass";
  const origin = lookupOrigin(request.nextUrl.origin, config.siteUrl, config.deployEnv);
  // The visitor's address from the platform's own header (Vercel), signed into the lookup so the
  // lookup's limiter keys on the visitor rather than on this proxy.
  const clientIp = clientIpFromHeaders(request.headers) ?? "";
  const verdict = await proxyLookup(config.readSecret, origin).verdict(pathname, clientIp);
  if (!verdict || verdict.verdict === "ok") return "pass";
  if (verdict.verdict === "redirect") return { redirect: verdict.location };
  return verdict.verdict;
}

/** Seconds a client should wait before retrying an Insights or Careers page that is unavailable. */
export const RETRY_AFTER_SECONDS = 120;

/**
 * The 503 page. The React shell cannot render here (the proxy answers before any page), so it is
 * a small, plain, accessible document with no external resources and no styles that need CSP
 * allowances.
 */
export function unavailableResponse(requestId: string): Response {
  const body = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Temporarily unavailable | Vitalos</title>
</head>
<body>
<main>
<h1>Temporarily unavailable</h1>
<p>This page is temporarily unavailable. Please try again in a few minutes.</p>
<p><a href="/">Go to the Vitalos homepage</a></p>
</main>
</body>
</html>
`;
  return new Response(body, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(RETRY_AFTER_SECONDS),
      "x-request-id": requestId,
    },
  });
}
