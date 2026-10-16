import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandName } from "@vitalos/cms";
import { loadArticlePage, loadPublishedPost } from "../../../../src/features/content/insights/load";
import { articleJsonLd, postHref } from "../../../../src/features/content/insights/model";
import { isSlug } from "../../../../src/features/content/readers";
import { INSIGHTS_BASE } from "../../../../src/features/content/routes";
import { getSeoContext } from "../../../../src/features/seo/context";
import { jsonLdGraph, webPageNode } from "../../../../src/features/seo/graph";
import type { JsonLdNode } from "../../../../src/features/seo/json-ld";
import { breadcrumbJsonLd, organizationId } from "../../../../src/features/seo/json-ld";
import { ArticleTemplate } from "../../../../src/templates/insights/ArticleTemplate";
import { insightsMetadata } from "../../../../src/templates/insights/metadata";

type Params = { slug: string };

/** The content builders return plain records; each one is a typed JSON-LD node or null. */
const asNode = (node: Record<string, unknown> | null) => node as JsonLdNode | null;

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
  const ctx = { siteUrl: getSeoContext().siteUrl };
  const path = postHref(data.post.slug);
  const url = new URL(path, ctx.siteUrl).toString();
  const canonical = data.post.seo.canonicalUrl;
  // One JSON-LD graph (docs/seo/DECISIONS.md 22): the WebPage, its BreadcrumbList and the Article,
  // linked by @id; the publisher is the site's Organization by reference. A preview never emits
  // structured data, and neither does a post whose canonical is another page (it describes that
  // page, not this one).
  const describesThisPage = !canonical || canonical === path || canonical === url;
  const jsonLd =
    data.previewStatus || !describesThisPage
      ? []
      : [
          jsonLdGraph([
            webPageNode(
              {
                path,
                name: data.post.title,
                description: data.post.excerpt,
                breadcrumb: true,
                dateModified: data.post.updatedAt?.iso ?? data.post.publishedAt.iso,
              },
              ctx,
            ),
            breadcrumbJsonLd(
              [
                { name: brandName, path: "/" },
                { name: "Insights", path: INSIGHTS_BASE },
                { name: data.post.title, path },
              ],
              ctx,
            ),
            asNode(articleJsonLd(data.post, ctx, { "@id": organizationId(ctx) })),
          ]),
        ];
  return <ArticleTemplate data={data} url={url} jsonLd={jsonLd} />;
}
