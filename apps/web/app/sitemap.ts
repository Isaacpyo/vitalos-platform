import type { MetadataRoute } from "next";
import { getContentSource } from "../src/lib/cms/get-content-source";
import { getSeoContext } from "../src/features/seo/context";
import { loadSitemap } from "../src/features/seo/sitemap";

/**
 * Gate-aware sitemap (ADR-022, ADR-028): gate-open, existing pages only. Content is static per
 * deploy, so the sitemap is built at build time and needs no revalidation. Non-production
 * environments are kept out of search engines by robots.txt and `X-Robots-Tag`, not by hiding the
 * sitemap, so gating can be tested against fixtures.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const source = await getContentSource();
  return loadSitemap(source, getSeoContext().siteUrl);
}
