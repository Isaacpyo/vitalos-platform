import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { isDetailIndexableNow } from "../../../../src/features/publication-gates/gates";
import { ArticlePage } from "../../../../src/templates/insights/ArticlePage";
import { listInsightParams, loadInsight } from "../../../../src/templates/insights/load";
import { hasNamedAuthor } from "../../../../src/templates/insights/map";
import { pageMetadata } from "../../../../src/templates/institutional/metadata";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return listInsightParams();
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadInsight(slug);
  if (!data) notFound();
  const { insight } = data;
  const named = hasNamedAuthor(insight);
  return pageMetadata({
    path: routes.insight(slug),
    title: insight.title,
    description: insight.summary,
    seo: insight.seo,
    type: "article",
    // Real dates and author names only; nothing is generated.
    article: {
      publishedTime: insight.publishedAt,
      modifiedTime: insight.updatedAt,
      authors: insight.authors.map((author) => author.title).filter((name) => name.trim() !== ""),
    },
    // A closed Insights gate, or a piece without a named author, is reachable but not indexed.
    noindex: insight.placeholder === true || !named || !(await isDetailIndexableNow("insights")),
  });
}

export default async function InsightRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const { slug } = await params;
  const data = await loadInsight(slug);
  if (!data) notFound();
  return <ArticlePage data={data} />;
}
