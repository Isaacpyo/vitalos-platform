import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildIndexView } from "../../../../../src/features/content/insights/model";
import { loadIndexPage } from "../../../../../src/features/content/insights/load";
import { isSlug } from "../../../../../src/features/content/readers";
import { INSIGHTS_BASE } from "../../../../../src/features/content/routes";
import { IndexTemplate } from "../../../../../src/templates/insights/IndexTemplate";
import { insightsMetadata } from "../../../../../src/templates/insights/metadata";

type Params = { format: string };

/**
 * `/insights?format={slug}` (brief 5.1). The public URL keeps the query string; `next.config.ts`
 * rewrites it here so the view stays static (ISR) instead of reading `searchParams`. Filtered
 * views are `noindex, follow` with the canonical on `/insights`.
 */
export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

async function load(params: Promise<Params>) {
  const { format } = await params;
  if (!isSlug(format)) notFound();
  const data = await loadIndexPage(1, format);
  const label = data.posts.formats.find((item) => item.slug === format)?.plural ?? format;
  return { ...data, format, label };
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { label, state } = await load(params);
  return insightsMetadata({
    path: INSIGHTS_BASE,
    title: label,
    description: state.insights.intro,
    noindex: true,
    follow: true,
  });
}

export default async function InsightsFormatPage({
  params,
}: Readonly<{ params: Promise<Params> }>) {
  const { state, posts, format } = await load(params);
  return (
    <IndexTemplate
      title={state.insights.heading}
      intro={state.insights.intro}
      view={buildIndexView(posts, { format })}
    />
  );
}
