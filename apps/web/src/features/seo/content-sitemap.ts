import type { MetadataRoute } from "next";
import { isKnownPath } from "../content/tags";
import type { SiteStateData, SitemapData } from "../content/schemas";

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

/**
 * The admin's entries for open sections only. The admin already leaves closed sections out; this
 * holds even when the two reads disagree for a moment, and a state that cannot be read counts as
 * closed (fail closed). Pure.
 */
export function openSectionsOnly(
  content: SitemapData | null,
  state: Pick<SiteStateData, "insightsOpen" | "careersOpen">,
): SitemapData | null {
  if (!content) return null;
  const open = (path: string) => {
    if (path === "/insights" || path.startsWith("/insights/")) return state.insightsOpen;
    if (path === "/careers" || path.startsWith("/careers/")) return state.careersOpen;
    return false;
  };
  return { ...content, entries: content.entries.filter((entry) => open(entry.path)) };
}
