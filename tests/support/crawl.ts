import type { APIRequestContext } from "@playwright/test";

/**
 * Dependency-free internal-link crawler over Playwright's APIRequestContext (no browser). Pages
 * are server-rendered, so every internal anchor is present in the HTML response. Redirects are
 * followed by hand so a chain or a loop is reported instead of hidden.
 */

const MAX_HOPS = 3;
const HREF = /<a\b[^>]*?\shref="([^"]*)"/gi;

export interface CrawlResult {
  /** Final status per requested URL (redirects resolved). */
  statuses: Map<string, number>;
  /** URL that linked to each URL, for readable failures. */
  referrers: Map<string, string>;
  failures: string[];
}

const decode = (value: string) => value.replaceAll("&amp;", "&");

/** Internal link targets in an HTML document: path plus query, no fragment. */
export function internalHrefs(html: string): string[] {
  const out = new Set<string>();
  for (const match of html.matchAll(HREF)) {
    const href = decode(match[1] ?? "").trim();
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const clean = href.split("#")[0] || "/";
    out.add(clean);
  }
  return [...out];
}

async function fetchResolved(request: APIRequestContext, url: string) {
  let current = url;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const response = await request.get(current, { maxRedirects: 0 });
    const status = response.status();
    if (status >= 300 && status < 400) {
      const location = response.headers()["location"];
      if (!location) return { status, html: "" };
      current = location.startsWith("http") ? new URL(location).pathname : location;
      continue;
    }
    const type = response.headers()["content-type"] ?? "";
    return { status, html: type.includes("text/html") ? await response.text() : "" };
  }
  return { status: 310, html: "" }; // too many redirects
}

/** Breadth-first crawl from `seeds`. Reports any 4xx/5xx, redirect loop or unresolved redirect. */
export async function crawl(
  request: APIRequestContext,
  seeds: readonly string[],
  options: { limit?: number; concurrency?: number } = {},
): Promise<CrawlResult> {
  const limit = options.limit ?? 400;
  const concurrency = options.concurrency ?? 8;
  const statuses = new Map<string, number>();
  const referrers = new Map<string, string>();
  const failures: string[] = [];
  const queued = new Set(seeds);
  let queue = [...queued];
  for (const seed of queue) referrers.set(seed, "(seed)");

  while (queue.length > 0 && statuses.size < limit) {
    const batch = queue.slice(0, concurrency);
    queue = queue.slice(concurrency);
    const results = await Promise.all(
      batch.map(async (url) => ({ url, ...(await fetchResolved(request, url)) })),
    );
    for (const { url, status, html } of results) {
      statuses.set(url, status);
      if (status >= 300) {
        failures.push(`${status} ${url} (linked from ${referrers.get(url) ?? "?"})`);
        continue;
      }
      for (const href of internalHrefs(html)) {
        if (href.startsWith("/_next/") || href.startsWith("/api/")) continue;
        if (queued.has(href)) continue;
        queued.add(href);
        referrers.set(href, url);
        queue.push(href);
      }
    }
  }
  return { statuses, referrers, failures };
}

/** `<loc>` values of a sitemap document. */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => decode(match[1] ?? "").trim());
}
