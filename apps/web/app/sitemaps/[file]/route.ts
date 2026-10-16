import { notFound } from "next/navigation";
import { loadSitemapSections } from "../../../src/features/seo/sitemap-sections";
import {
  isSitemapSection,
  sitemapSections,
  urlsetXml,
  xmlResponse,
} from "../../../src/features/seo/sitemap-xml";

/**
 * One child sitemap per section (`/sitemaps/pages.xml`, `insights.xml`, `careers.xml`): gate-open,
 * existing, canonical URLs only, with `lastmod` from content dates, never the build time.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { file: string }[] {
  return sitemapSections.map((section) => ({ file: `${section}.xml` }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const section = (await params).file.replace(/\.xml$/, "");
  if (!isSitemapSection(section)) notFound();
  return xmlResponse(urlsetXml((await loadSitemapSections())[section]));
}
