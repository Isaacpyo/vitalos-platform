import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandName } from "@vitalos/cms";
import { loadChromeContent } from "../../../../src/components/site-chrome/load";
import { loadArticlePage, loadPublishedPost } from "../../../../src/features/content/insights/load";
import { articleJsonLd, postHref } from "../../../../src/features/content/insights/model";
import { isSlug } from "../../../../src/features/content/readers";
import { INSIGHTS_BASE } from "../../../../src/features/content/routes";
import { getSeoContext } from "../../../../src/features/seo/context";
import { breadcrumbJsonLd, organizationJsonLd } from "../../../../src/features/seo/json-ld";
import { ArticleTemplate } from "../../../../src/templates/insights/ArticleTemplate";
import { insightsMetadata } from "../../../../src/templates/insights/metadata";

type Params = { slug: string };

/** Articles are generated on first request, then served from ISR and refreshed by their tags. */
export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

async function slugOf(params: Promise<Params>): Promise<string> {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  return slug;
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const post = await loadPublishedPost(await slugOf(params));
  return insightsMetadata({
    path: postHref(post.slug),
    canonicalPath: post.seo.canonicalUrl ?? undefined,
    title: post.seo.title || post.title,
    description: post.seo.description || post.excerpt,
    noindex: post.seo.noindex,
    article: {
      publishedTime: post.publishedAt.iso,
      ...(post.updatedAt ? { modifiedTime: post.updatedAt.iso } : {}),
      authors: post.authors.map((author) => author.name),
    },
  });
}

export default async function ArticleRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const data = await loadArticlePage(await slugOf(params));
  const { settings } = await loadChromeContent();
  const ctx = { siteUrl: getSeoContext().siteUrl };
  const url = new URL(postHref(data.post.slug), ctx.siteUrl).toString();
  // The publisher is the site's Organization node (its logo only when site settings have one).
  const publisher = Object.fromEntries(
    Object.entries(organizationJsonLd(settings, ctx)).filter(([key]) => key !== "@context"),
  );
  // A preview never emits structured data.
  const jsonLd = data.previewStatus
    ? []
    : [
        articleJsonLd(data.post, ctx, publisher),
        breadcrumbJsonLd(
          [
            { name: brandName, path: "/" },
            { name: "Insights", path: INSIGHTS_BASE },
            { name: data.post.title, path: postHref(data.post.slug) },
          ],
          ctx,
        ),
      ];
  return <ArticleTemplate data={data} url={url} jsonLd={jsonLd} />;
}
