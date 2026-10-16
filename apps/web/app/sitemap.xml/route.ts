import { loadSitemapIndex } from "../../src/features/seo/sitemap-sections";
import { sitemapIndexXml, xmlResponse } from "../../src/features/seo/sitemap-xml";

/**
 * Sitemap index (ADR-022, docs/seo/DECISIONS.md 12): one child per section with URLs. Content is
 * static per deploy, so it is built at build time. Non-production environments are kept out of
 * search engines by robots.txt and `X-Robots-Tag`, not by hiding the sitemap, so gating can be
 * tested against fixtures.
 */
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  return xmlResponse(sitemapIndexXml(await loadSitemapIndex()));
}
