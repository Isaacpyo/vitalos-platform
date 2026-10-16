// HTTP helpers for the SEO tools: fetch without following redirects (so chains are visible), with
// an optional Host header (a local production build is fetched as the canonical host), and read a
// sitemap or sitemap index. No dependencies, so workflows can run it without installing packages.
import http from "node:http";
import https from "node:https";

const MAX_HOPS = 5;

/** GET one URL without following redirects. */
export function fetchRaw(url, { host, timeoutMs = 20_000, method = "GET" } = {}) {
  const target = new URL(url);
  const client = target.protocol === "https:" ? https : http;
  const started = performance.now();
  return new Promise((resolve) => {
    const request = client.request(
      target,
      {
        method,
        headers: {
          "user-agent": "VitalosSeoCrawler/1.0 (+https://vitalos.co.uk)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...(host ? { host } : {}),
        },
        timeout: timeoutMs,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
            ms: Math.round(performance.now() - started),
          }),
        );
      },
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", (error) =>
      resolve({ status: 0, headers: {}, body: "", ms: 0, error: String(error.message) }),
    );
    request.end();
  });
}

/** Follows redirects by hand so chains and loops are visible. */
export async function fetchResolved(origin, path, options) {
  const hops = [];
  let current = path;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const response = await fetchRaw(new URL(current, origin).toString(), options);
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      const next = new URL(response.headers.location, new URL(current, origin));
      hops.push({ from: current, status: response.status, to: next.toString() });
      // Off-site redirect: stop there.
      if (next.origin !== new URL(origin).origin && !isSameHost(next, options?.host)) {
        return { ...response, hops, final: next.toString() };
      }
      current = next.pathname + next.search;
      if (hops.some((h, i) => i < hops.length - 1 && h.from === current)) {
        return { ...response, status: 508, hops, final: current };
      }
      continue;
    }
    return { ...response, hops, final: current };
  }
  return { status: 310, headers: {}, body: "", ms: 0, hops, final: current };
}

const isSameHost = (url, host) => Boolean(host) && url.host === host;

/** `<loc>` values of a sitemap or sitemap index, following child sitemaps once. */
export async function readSitemap(origin, path, options, seen = new Set()) {
  if (seen.has(path)) return { urls: [], files: [] };
  seen.add(path);
  const response = await fetchResolved(origin, path, options);
  if (response.status !== 200) return { urls: [], files: [{ path, status: response.status }] };
  const locs = [...response.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  const lastmods = [...response.body.matchAll(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/g)].map(
    (m) => m[1],
  );
  const files = [{ path, status: 200, isIndex: response.body.includes("<sitemapindex") }];
  if (!files[0].isIndex) {
    return { urls: locs.map((loc, i) => ({ loc, lastmod: lastmods[i] ?? "" })), files };
  }
  const urls = [];
  for (const loc of locs) {
    const child = new URL(loc);
    const nested = await readSitemap(origin, child.pathname, options, seen);
    urls.push(...nested.urls);
    files.push(...nested.files);
  }
  return { urls, files };
}
