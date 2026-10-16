import "server-only";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";
import { getContentReaders } from "../content/server";
import { getSiteStateOrClosed } from "../content/site-state";
import { getSeoContext } from "./context";
import { mergeContentSitemap, openSectionsOnly } from "./content-sitemap";
import { loadSitemap } from "./sitemap";
import { latestModified, partitionSitemap, sitemapChildPath, sitemapSections } from "./sitemap-xml";
import type { SitemapSection } from "./sitemap-xml";

/**
 * Every sitemap URL, split by section. The single loader behind `/sitemap.xml` and its children,
 * and the place the Super Admin's Insights and Careers entries (ADR-039) join the CMS entries.
 *
 * The admin entries come through the cached `sitemap` read (tag `sitemap`) and the site state
 * (tag `site`), so the routes that render them carry both tags and a publish, removal or section
 * change refreshes them. Fail-soft: a failed admin read leaves the CMS entries alone; a section
 * that is closed (or whose state cannot be read) contributes nothing, even if the read lists it.
 */
export async function loadSitemapSections(): Promise<
  Record<SitemapSection, MetadataRoute.Sitemap>
> {
  const source = await getContentSource();
  const { siteUrl } = getSeoContext();
  const [base, content, state] = await Promise.all([
    loadSitemap(source, siteUrl),
    getContentReaders()
      .sitemap()
      .then((result) => (result.kind === "ok" ? result.data : null))
      .catch(() => null),
    getSiteStateOrClosed(),
  ]);
  return partitionSitemap(mergeContentSitemap(base, openSectionsOnly(content, state), { siteUrl }));
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
