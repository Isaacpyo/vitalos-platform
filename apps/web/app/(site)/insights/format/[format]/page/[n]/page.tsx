import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  buildIndexView,
  indexHref,
} from "../../../../../../../src/features/content/insights/model";
import { loadIndexPage } from "../../../../../../../src/features/content/insights/load";
import { isSlug } from "../../../../../../../src/features/content/readers";
import { INSIGHTS_BASE } from "../../../../../../../src/features/content/routes";
import { IndexTemplate } from "../../../../../../../src/templates/insights/IndexTemplate";
import { insightsMetadata } from "../../../../../../../src/templates/insights/metadata";

type Params = { format: string; n: string };

/** `/insights?format={slug}&page={n}`, rewritten here by `next.config.ts` (see the format page). */
export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

async function load(params: Promise<Params>) {
  const { format, n } = await params;
  if (!isSlug(format) || !/^[1-9][0-9]{0,3}$/.test(n)) notFound();
  const page = Number(n);
  if (page === 1) permanentRedirect(indexHref(1, format));
  const data = await loadIndexPage(page, format);
  const label = data.posts.formats.find((item) => item.slug === format)?.plural ?? format;
  return { ...data, format, label, page };
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { label, page, state } = await load(params);
  return insightsMetadata({
    path: INSIGHTS_BASE,
    title: `${label}, page ${page}`,
    description: state.insights.intro,
    noindex: true,
    follow: true,
  });
}

export default async function InsightsFormatPageN({
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
