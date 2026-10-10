import type { MetadataRoute } from "next";
import { getPublishedContentSource } from "../src/lib/cms/get-content-source";
import { getSeoContext } from "../src/features/seo/context";
import { loadSitemap } from "../src/features/seo/sitemap";

/**
 * Gate-aware sitemap (ADR-018, ADR-022): published, gate-open, existing pages only. Always built
 * from the published perspective, never from drafts. It is tag-cached with the rest of the
 * content, so a Sanity webhook refreshes it. Non-production environments are kept out of search
 * engines by robots.txt and `X-Robots-Tag`, not by hiding the sitemap, so gating can be tested
 * against fixtures.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const source = await getPublishedContentSource();
  return loadSitemap(source, getSeoContext().siteUrl);
}
