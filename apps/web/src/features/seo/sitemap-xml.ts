import type { MetadataRoute } from "next";

/**
 * Sitemap index split by type (docs/seo/DECISIONS.md 12): `/sitemap.xml` is a `<sitemapindex>`
 * that lists one child per section that has URLs, `/sitemaps/{section}.xml`. Pure functions; the
 * route handlers in `app/sitemap.xml` and `app/sitemaps/[file]` render them.
 *
 * Insights and Careers get their own children because their URLs change on publish (PR #46),
 * not on deploy, and so search engines can report coverage per section.
 */
export const sitemapSections = ["pages", "insights", "careers"] as const;
export type SitemapSection = (typeof sitemapSections)[number];

export const sitemapChildPath = (section: SitemapSection): string => `/sitemaps/${section}.xml`;

export const isSitemapSection = (value: string): value is SitemapSection =>
  (sitemapSections as readonly string[]).includes(value);

const inSection = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

export function sectionForPath(path: string): SitemapSection {
  if (inSection(path, "/insights")) return "insights";
  if (inSection(path, "/careers")) return "careers";
  return "pages";
}

/** Splits one flat sitemap into its sections, keeping order. */
export function partitionSitemap(
  entries: MetadataRoute.Sitemap,
): Record<SitemapSection, MetadataRoute.Sitemap> {
  const out: Record<SitemapSection, MetadataRoute.Sitemap> = {
    pages: [],
    insights: [],
    careers: [],
  };
  for (const entry of entries) {
    const path = URL.canParse(entry.url) ? new URL(entry.url).pathname : entry.url;
    out[sectionForPath(path)].push(entry);
  }
  return out;
}

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const lastmod = (value: string | Date | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** Latest real content date in a section, for the index entry (none when no entry has one). */
export function latestModified(entries: MetadataRoute.Sitemap): string | undefined {
  const times = entries
    .map((entry) => lastmod(entry.lastModified))
    .filter((value): value is string => value !== undefined)
    .sort();
  return times.at(-1);
}

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

export function urlsetXml(entries: MetadataRoute.Sitemap): string {
  const urls = entries.map((entry) => {
    const modified = lastmod(entry.lastModified);
    return `<url><loc>${escapeXml(entry.url)}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ""}</url>`;
  });
  return `${XML_DECLARATION}\n<urlset ${NS}>\n${urls.join("\n")}\n</urlset>\n`;
}

export function sitemapIndexXml(
  children: readonly { loc: string; lastModified?: string | undefined }[],
): string {
  const items = children.map(
    (child) =>
      `<sitemap><loc>${escapeXml(child.loc)}</loc>${child.lastModified ? `<lastmod>${child.lastModified}</lastmod>` : ""}</sitemap>`,
  );
  return `${XML_DECLARATION}\n<sitemapindex ${NS}>\n${items.join("\n")}\n</sitemapindex>\n`;
}

export const xmlResponse = (body: string): Response =>
  new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
