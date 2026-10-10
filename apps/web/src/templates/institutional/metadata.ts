import "server-only";
import type { Metadata } from "next";
import { buildMetadata } from "../../features/seo/metadata";
import type { PageMetadataInput } from "../../features/seo/metadata";
import { getContentSource } from "../../lib/cms/get-content-source";

/**
 * `buildMetadata` with the site-wide default SEO filled in from site settings. Pages pass the
 * canonical `path` (routes.ts), the document's own title, summary and SEO, and `noindex` for a
 * detail page of a closed publication gate or a page without content.
 */
export async function pageMetadata(
  input: Omit<PageMetadataInput, "defaultSeo">,
): Promise<Metadata> {
  const chrome = await (await getContentSource()).getSiteChrome();
  return buildMetadata({ ...input, defaultSeo: chrome.settings.defaultSeo });
}
