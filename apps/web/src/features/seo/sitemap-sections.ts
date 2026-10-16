import "server-only";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";
import { getSeoContext } from "./context";
import { loadSitemap } from "./sitemap";
import { latestModified, partitionSitemap, sitemapChildPath, sitemapSections } from "./sitemap-xml";
import type { SitemapSection } from "./sitemap-xml";

/**
 * Every sitemap URL, split by section. The single loader behind `/sitemap.xml` and its children,
 * and the place Insights and Careers entries from the Super Admin join the CMS entries (PR #46,
 * `mergeContentSitemap`).
 */
export async function loadSitemapSections(): Promise<
  Record<SitemapSection, MetadataRoute.Sitemap>
> {
  const source = await getContentSource();
  return partitionSitemap(await loadSitemap(source, getSeoContext().siteUrl));
}

/** Children for the index: only sections with at least one URL. */
export async function loadSitemapIndex(): Promise<
  { section: SitemapSection; loc: string; lastModified?: string | undefined }[]
> {
  const sections = await loadSitemapSections();
  const { siteUrl } = getSeoContext();
  return sitemapSections
    .filter((section) => sections[section].length > 0)
    .map((section) => ({
      section,
      loc: absoluteUrl(siteUrl, sitemapChildPath(section)),
      lastModified: latestModified(sections[section]),
    }));
}
