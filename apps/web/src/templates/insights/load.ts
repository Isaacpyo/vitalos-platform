import "server-only";
import { cache } from "react";
import type { ContentSource, InsightView, PublicationGates, RoutePageView } from "@vitalos/cms";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource, getPublishedContentSource } from "../../lib/cms/get-content-source";
import { hasNamedAuthor, sortByPublishedDesc } from "./map";

async function publicInsights(source: ContentSource, draft: boolean): Promise<InsightView[]> {
  const summaries = await source.listSummaries("insight");
  const views = await Promise.all(summaries.map((s) => source.getDocument("insight", s.slug)));
  const listed = views.filter(
    (view): view is InsightView => view !== null && (draft || hasNamedAuthor(view)),
  );
  return sortByPublishedDesc(listed);
}

export interface InsightsIndexData {
  page: RoutePageView | null;
  /** Newest first. */
  insights: InsightView[];
  draft: boolean;
}

export const loadInsightsIndex = cache(async (): Promise<InsightsIndexData> => {
  const source = await getContentSource();
  const draft = await isDraftModeEnabled();
  const [page, insights] = await Promise.all([
    source.getRoutePage("insights"),
    publicInsights(source, draft),
  ]);
  return { page, insights, draft };
});

export interface InsightData {
  insight: InsightView;
  gates: PublicationGates;
  draft: boolean;
}

export const loadInsight = cache(async (slug: string): Promise<InsightData | null> => {
  const source = await getContentSource();
  const [insight, gates, draft] = await Promise.all([
    source.getDocument("insight", slug),
    source.getPublicationGates(),
    isDraftModeEnabled(),
  ]);
  return insight ? { insight, gates, draft } : null;
});

export async function listInsightParams(): Promise<{ slug: string }[]> {
  const source = await getPublishedContentSource();
  return (await source.listParams("insight")).flatMap((params) =>
    params.slug ? [{ slug: params.slug }] : [],
  );
}
