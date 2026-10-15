import type { MetadataRoute } from "next";
import { isKnownPath } from "../content/tags";
import type { SitemapData } from "../content/schemas";

/**
 * Merges the Super Admin's `sitemap` read (Insights and Careers, ADR-039) into the gate-aware
 * CMS sitemap (ADR-022). Pure.
 *
 * - CMS Insights and Careers entries are always dropped: both are served only from the admin.
 * - Admin entries are listed only for known Insights and Careers page patterns (never "/" or the
 *   sitemap itself). A failed read passes `null`: the CMS entries stand alone (fail-soft).
 */
export function mergeContentSitemap(
  base: MetadataRoute.Sitemap,
  content: SitemapData | null,
  options: { siteUrl: string },
): MetadataRoute.Sitemap {
  const pathOf = (url: string) => (URL.canParse(url) ? new URL(url).pathname : url);
  const inSection = (path: string, section: string) =>
    path === section || path.startsWith(`${section}/`);
  const kept = base.filter((entry) => {
    const path = pathOf(entry.url);
    return !inSection(path, "/insights") && !inSection(path, "/careers");
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
