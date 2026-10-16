import "server-only";
import type { Metadata } from "next";
import { FEED_PATH, insightsTitle } from "../../features/content/insights/model";
import { pageMetadata } from "../institutional/metadata";

/**
 * Metadata for every Insights page (brief 5.3): "{SEO title} | Vitalos Insights", description,
 * canonical, Open Graph and Twitter through the site's `pageMetadata`, the feed advertised with
 * `<link rel="alternate">`, and `noindex` when asked (filtered views keep `follow`).
 */
export async function insightsMetadata(input: {
  path: string;
  title: string;
  description?: string | undefined;
  noindex?: boolean | undefined;
  follow?: boolean | undefined;
  /** Canonical override: a site path (filtered views point at /insights) or an https URL. */
  canonicalPath?: string | undefined;
  article?: { publishedTime?: string; modifiedTime?: string; authors?: readonly string[] };
}): Promise<Metadata> {
  const external =
    input.canonicalPath && /^https:\/\//.test(input.canonicalPath)
      ? input.canonicalPath
      : undefined;
  const metadata = await pageMetadata({
    path: external ? input.path : (input.canonicalPath ?? input.path),
    title: insightsTitle(input.title),
    description: input.description,
    absoluteTitle: true,
    noindex: input.noindex,
    follow: input.follow,
    feed: FEED_PATH,
    ...(input.article ? { type: "article" as const, article: input.article } : {}),
  });
  return external
    ? { ...metadata, alternates: { ...metadata.alternates, canonical: external } }
    : metadata;
}
