import type { MetadataRoute } from "next";
import { getContentSource } from "../src/lib/cms/get-content-source";
import { getContentReaders } from "../src/features/content/server";
import { getSeoContext } from "../src/features/seo/context";
import { mergeContentSitemap } from "../src/features/seo/content-sitemap";
import { loadSitemap } from "../src/features/seo/sitemap";

/**
 * Gate-aware sitemap (ADR-022, ADR-028) plus the Super Admin's Insights and Careers URLs
 * (ADR-035), read through the cached `sitemap` reader (tag `sitemap`). A failed admin read keeps
 * the CMS entries (fail-soft). Non-production environments are kept out of search engines by
 * robots.txt and `X-Robots-Tag`, not by hiding the sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const source = await getContentSource();
  const { siteUrl } = getSeoContext();
  const readers = getContentReaders();
  const [base, content] = await Promise.all([
    loadSitemap(source, siteUrl),
    readers
      .sitemap()
      .then((result) => (result.kind === "ok" ? result.data : null))
      .catch(() => null),
  ]);
  return mergeContentSitemap(base, content, { siteUrl, contentConfigured: readers.configured });
}
