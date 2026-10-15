import type { MetadataRoute } from "next";
import { isKnownPath } from "../content/tags";
import type { SitemapData } from "../content/schemas";

/**
 * Merges the Super Admin's `sitemap` read (Insights and Careers, ADR-035) into the gate-aware
 * CMS sitemap (ADR-022). Pure.
 *
 * - CMS Insights entries are always dropped: Insights is served only from the admin.
 * - CMS Careers entries are dropped once the content API is configured (until then the Careers
 *   pages still come from the CMS).
 * - Admin entries are listed only for known Insights and Careers page patterns (never "/" or the
 *   sitemap itself). A failed read passes `null`: the CMS entries stand alone (fail-soft).
 */
export function mergeContentSitemap(
  base: MetadataRoute.Sitemap,
  content: SitemapData | null,
  options: { siteUrl: string; contentConfigured: boolean },
): MetadataRoute.Sitemap {
  const pathOf = (url: string) => (URL.canParse(url) ? new URL(url).pathname : url);
  const inSection = (path: string, section: string) =>
    path === section || path.startsWith(`${section}/`);
  const kept = base.filter((entry) => {
    const path = pathOf(entry.url);
    if (inSection(path, "/insights")) return false;
    return !(options.contentConfigured && inSection(path, "/careers"));
  });
  const seen = new Set(kept.map((entry) => entry.url));
  const added: MetadataRoute.Sitemap = [];
  for (const entry of content?.entries ?? []) {
    if (!isKnownPath(entry.path) || entry.path === "/" || entry.path === "/sitemap.xml") continue;
    if (!inSection(entry.path, "/insights") && !inSection(entry.path, "/careers")) continue;
    const url = new URL(entry.path, options.siteUrl).toString().replace(/\/$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    const time = Date.parse(entry.lastModified);
    added.push({ url, ...(Number.isNaN(time) ? {} : { lastModified: new Date(time) }) });
  }
  return [...kept, ...added];
}
