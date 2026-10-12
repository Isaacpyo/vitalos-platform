import "server-only";
import { cache } from "react";
import type { ContentSource, InsightView, PublicationGates, RoutePageView } from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";
import { hasNamedAuthor, sortByPublishedDesc } from "./map";

async function publicInsights(source: ContentSource): Promise<InsightView[]> {
  const summaries = await source.listSummaries("insight");
  const views = await Promise.all(summaries.map((s) => source.getDocument("insight", s.slug)));
  const listed = views.filter((view): view is InsightView => view !== null && hasNamedAuthor(view));
  return sortByPublishedDesc(listed);
}

export interface InsightsIndexData {
  page: RoutePageView | null;
  /** Newest first. */
  insights: InsightView[];
}

export const loadInsightsIndex = cache(async (): Promise<InsightsIndexData> => {
  const source = await getContentSource();
  const [page, insights] = await Promise.all([
    source.getRoutePage("insights"),
    publicInsights(source),
  ]);
  return { page, insights };
});

export interface InsightData {
  insight: InsightView;
  gates: PublicationGates;
}

export const loadInsight = cache(async (slug: string): Promise<InsightData | null> => {
  const source = await getContentSource();
  const [insight, gates] = await Promise.all([
    source.getDocument("insight", slug),
    source.getPublicationGates(),
  ]);
  return insight ? { insight, gates } : null;
});

export async function listInsightParams(): Promise<{ slug: string }[]> {
  const source = await getContentSource();
  return (await source.listParams("insight")).flatMap((params) =>
    params.slug ? [{ slug: params.slug }] : [],
  );
}
