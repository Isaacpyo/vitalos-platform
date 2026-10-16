import { loadPublishedPost } from "../../../../src/features/content/insights/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

/**
 * The article's Open Graph image on the site's one template (docs/seo/DECISIONS.md 21): the
 * format and date in mono, the title with its full stop in Vitalos Blue. It reads through the same
 * cached reader as the page, so it carries the post's tags and updates when the post does.
 */
export const alt = "Vitalos Insights";
export const size = ogSize;
export const contentType = ogContentType;

/** Generated on first request, then cached (ISR) with the post's tags. */
export const generateStaticParams = (): { slug: string }[] => [];

export default async function OpenGraphImage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const post = await loadPublishedPost((await params).slug);
  return renderOgImage({
    eyebrow: `${post.format.label} · ${post.publishedAt.short}`,
    title: post.title,
  });
}
