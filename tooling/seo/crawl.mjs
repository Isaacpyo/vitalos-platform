// SEO crawler (docs/seo/AUDIT.md, `pnpm seo:check`). Fetches server HTML only (no JavaScript), the
// way a crawler's first pass sees the site, and records what search engines read on each URL.
//
// Requests go through node:http(s) so the Host header can be set: a local production build is
// crawled as if it were the canonical host, and again as a preview host, without DNS.
import { parse } from "parse5";
import { fetchResolved, readSitemap } from "./fetch.mjs";

export { fetchRaw, fetchResolved, readSitemap } from "./fetch.mjs";

/* ---------- parse5 tree helpers ---------- */

const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value ?? null;

function* walk(node) {
  yield node;
  const children = node.tagName === "template" ? node.content?.childNodes : node.childNodes;
  for (const child of children ?? []) yield* walk(child);
}

const findAll = (root, predicate) => [...walk(root)].filter((n) => n.tagName && predicate(n));
const find = (root, predicate) => {
  for (const n of walk(root)) if (n.tagName && predicate(n)) return n;
  return null;
};
const tag = (name) => (n) => n.tagName === name;

const SKIP_TEXT = new Set(["script", "style", "noscript", "template"]);
function rawText(node) {
  if (node.nodeName === "#text") return node.value;
  if (SKIP_TEXT.has(node.tagName)) return "";
  return (node.childNodes ?? []).map(rawText).join(" ");
}
const text = (node) => (node ? rawText(node).replace(/\s+/g, " ").trim() : "");
/** Text of a script element (rawText skips scripts). */
const scriptText = (node) => (node.childNodes ?? []).map((c) => c.value ?? "").join("");

/** What a search engine reads from one HTML document. */
export function parsePage(html) {
  const doc = parse(html);
  const htmlEl = find(doc, tag("html"));
  const head = find(doc, tag("head"));
  const body = find(doc, tag("body"));
  const metas = head ? findAll(head, tag("meta")) : [];
  const meta = (key, value) => {
    const found = metas.find((m) => attr(m, key) === value);
    return found ? (attr(found, "content") ?? "").trim() : "";
  };
  const headings = findAll(body ?? doc, (n) => /^h[1-6]$/.test(n.tagName)).map((h) => ({
    level: Number(h.tagName.slice(1)),
    text: text(h),
  }));
  const jsonLd = findAll(
    doc,
    (n) => n.tagName === "script" && attr(n, "type") === "application/ld+json",
  ).map((s) => {
    try {
      return { ok: true, data: JSON.parse(scriptText(s)) };
    } catch (error) {
      return { ok: false, error: String(error.message) };
    }
  });
  const links = findAll(body ?? doc, (n) => n.tagName === "a" && attr(n, "href") !== null).map(
    (a) => ({
      href: attr(a, "href") ?? "",
      text: text(a) || attr(a, "aria-label") || "",
      rel: attr(a, "rel") ?? "",
    }),
  );
  const images = findAll(body ?? doc, tag("img")).map((img) => ({
    src: attr(img, "src") ?? "",
    alt: attr(img, "alt"),
    width: attr(img, "width"),
    height: attr(img, "height"),
  }));
  const main = find(doc, tag("main")) ?? body;
  const words = text(main).split(" ").filter(Boolean).length;
  const canonical = head
    ? findAll(head, (n) => n.tagName === "link" && attr(n, "rel") === "canonical")
    : [];
  return {
    lang: htmlEl ? (attr(htmlEl, "lang") ?? "") : "",
    title: head ? text(find(head, tag("title"))) : "",
    titleCount: head ? findAll(head, tag("title")).length : 0,
    description: meta("name", "description"),
    canonical: canonical[0] ? (attr(canonical[0], "href") ?? "") : "",
    canonicalCount: canonical.length,
    robots: meta("name", "robots"),
    headings,
    words,
    links,
    images,
    jsonLd,
    og: {
      title: meta("property", "og:title"),
      description: meta("property", "og:description"),
      url: meta("property", "og:url"),
      image: meta("property", "og:image"),
      type: meta("property", "og:type"),
      siteName: meta("property", "og:site_name"),
      locale: meta("property", "og:locale"),
    },
    twitter: { card: meta("name", "twitter:card") },
    verification: {
      google: meta("name", "google-site-verification"),
      bing: meta("name", "msvalidate.01"),
    },
  };
}

/** Internal link target as a site path (query kept, fragment dropped), or null. */
export function internalPath(href, pageUrl, siteHosts) {
  if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) return null;
  let url;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return null;
  }
  if (!siteHosts.has(url.host)) return null;
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return null;
  return url.pathname + url.search;
}

/**
 * Breadth-first crawl from the home page and every sitemap URL. Returns one record per URL plus
 * the link graph, so inbound links, click depth and orphans can be computed.
 */
export async function crawlSite({
  origin,
  host,
  canonicalOrigin,
  limit = 500,
  concurrency = 6,
  extraSeeds = [],
}) {
  const options = { host };
  const siteHosts = new Set([new URL(origin).host]);
  if (host) siteHosts.add(host);
  if (canonicalOrigin) siteHosts.add(new URL(canonicalOrigin).host);

  const sitemap = await readSitemap(origin, "/sitemap.xml", options);
  const sitemapPaths = sitemap.urls.map((u) => {
    const url = new URL(u.loc);
    return url.pathname + url.search;
  });

  const pages = new Map();
  const edges = new Map(); // from -> Set(to)
  const queue = ["/", ...sitemapPaths, ...extraSeeds];
  const queued = new Set(queue);

  while (queue.length > 0 && pages.size < limit) {
    const batch = queue.splice(0, concurrency);
    const results = await Promise.all(
      batch.map(async (path) => ({ path, response: await fetchResolved(origin, path, options) })),
    );
    for (const { path, response } of results) {
      const record = {
        path,
        status: response.status,
        hops: response.hops,
        final: response.final,
        ms: response.ms,
        contentType: String(response.headers["content-type"] ?? ""),
        xRobotsTag: String(response.headers["x-robots-tag"] ?? ""),
        error: response.error,
      };
      pages.set(path, record);
      if (response.status !== 200 || !record.contentType.includes("text/html")) continue;
      const pageUrl = new URL(response.final, canonicalOrigin ?? origin).toString();
      record.page = parsePage(response.body);
      const out = new Set();
      for (const link of record.page.links) {
        const target = internalPath(link.href, pageUrl, siteHosts);
        if (target === null) continue;
        out.add(target);
        if (!queued.has(target)) {
          queued.add(target);
          queue.push(target);
        }
      }
      edges.set(path, out);
    }
  }

  // Inbound links (from other pages only) and click depth from the home page.
  const inbound = new Map();
  for (const [from, targets] of edges) {
    for (const to of targets) {
      if (to === from) continue;
      if (!inbound.has(to)) inbound.set(to, new Set());
      inbound.get(to).add(from);
    }
  }
  const depth = new Map([["/", 0]]);
  const frontier = ["/"];
  while (frontier.length > 0) {
    const current = frontier.shift();
    for (const next of edges.get(current) ?? []) {
      if (depth.has(next)) continue;
      depth.set(next, depth.get(current) + 1);
      frontier.push(next);
    }
  }
  for (const record of pages.values()) {
    record.inbound = inbound.get(record.path)?.size ?? 0;
    record.outbound = edges.get(record.path)?.size ?? 0;
    record.depth = depth.get(record.path) ?? null;
    record.inSitemap = sitemapPaths.includes(record.path);
  }

  return { pages: [...pages.values()], sitemap, sitemapPaths, edges };
}

const csvCell = (value) => {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** One CSV row per crawled URL (docs/seo/crawl/). */
export function toCsv(pages) {
  const columns = [
    ["url", (r) => r.path],
    ["status", (r) => r.status],
    ["redirect", (r) => r.hops?.map((h) => `${h.status} ${h.to}`).join(" > ")],
    ["response_ms", (r) => r.ms],
    ["x_robots_tag", (r) => r.xRobotsTag],
    ["meta_robots", (r) => r.page?.robots],
    ["title", (r) => r.page?.title],
    ["title_len", (r) => r.page?.title.length],
    ["description", (r) => r.page?.description],
    ["description_len", (r) => r.page?.description.length],
    ["canonical", (r) => r.page?.canonical],
    ["h1_count", (r) => r.page?.headings.filter((h) => h.level === 1).length],
    ["h1", (r) => r.page?.headings.find((h) => h.level === 1)?.text],
    [
      "outline",
      (r) =>
        r.page?.headings
          .filter((h) => h.level <= 3)
          .map((h) => `h${h.level}:${h.text}`)
          .join(" | "),
    ],
    ["words", (r) => r.page?.words],
    ["links_in", (r) => r.inbound],
    ["links_out", (r) => r.outbound],
    ["depth", (r) => r.depth],
    ["in_sitemap", (r) => r.inSitemap],
    ["images", (r) => r.page?.images.length],
    ["images_no_alt", (r) => r.page?.images.filter((i) => i.alt === null).length],
    [
      "json_ld_types",
      (r) =>
        r.page?.jsonLd
          .flatMap((b) => (b.ok ? jsonLdTypes(b.data) : ["INVALID"]))
          .sort()
          .join(" "),
    ],
    ["og_title", (r) => r.page?.og.title],
    ["og_image", (r) => r.page?.og.image],
    ["og_url", (r) => r.page?.og.url],
    ["twitter_card", (r) => r.page?.twitter.card],
  ];
  const header = columns.map(([name]) => name).join(",");
  const rows = pages
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((r) => columns.map(([, get]) => csvCell(get(r))).join(","));
  return `${[header, ...rows].join("\n")}\n`;
}

/** Every `@type` in a JSON-LD value (graphs, arrays and nested nodes). */
export function jsonLdTypes(value) {
  const out = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    if (node["@type"]) out.push(...[node["@type"]].flat());
    for (const [key, child] of Object.entries(node)) if (key !== "@context") visit(child);
  };
  visit(value);
  return out;
}
