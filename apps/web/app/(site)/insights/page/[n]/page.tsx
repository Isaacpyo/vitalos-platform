import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { buildIndexView, indexHref } from "../../../../../src/features/content/insights/model";
import { loadIndexPage } from "../../../../../src/features/content/insights/load";
import { INSIGHTS_BASE } from "../../../../../src/features/content/routes";
import { IndexTemplate } from "../../../../../src/templates/insights/IndexTemplate";
import { insightsMetadata } from "../../../../../src/templates/insights/metadata";

type Params = { n: string };

/** Pages are generated on first request and then served from ISR. */
export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

function pageNumber(value: string): number {
  if (!/^[1-9][0-9]{0,3}$/.test(value)) notFound();
  const page = Number(value);
  if (page === 1) permanentRedirect(INSIGHTS_BASE);
  return page;
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const page = pageNumber((await params).n);
  const { state } = await loadIndexPage(page);
  return insightsMetadata({
    path: indexHref(page),
    title: `Page ${page}`,
    description: state.insights.intro,
  });
}

export default async function InsightsPageN({ params }: Readonly<{ params: Promise<Params> }>) {
  const page = pageNumber((await params).n);
  const { state, posts } = await loadIndexPage(page);
  return (
    <IndexTemplate
      title={state.insights.heading}
      intro={state.insights.intro}
      view={buildIndexView(posts)}
    />
  );
}
