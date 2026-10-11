import "server-only";
import { cache } from "react";
import type {
  TrustTopic,
  TrustTopicSummary,
  TrustTopicView,
  TrustOverviewView,
} from "@vitalos/cms";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource, getPublishedContentSource } from "../../lib/cms/get-content-source";
import { isTrustTopic } from "./map";

export interface TrustOverviewData {
  page: TrustOverviewView | null;
  topics: TrustTopicSummary[];
  draft: boolean;
}

export const loadTrustOverview = cache(async (): Promise<TrustOverviewData> => {
  const source = await getContentSource();
  const [page, topics, draft] = await Promise.all([
    source.getRoutePage("trust"),
    source.listSummaries("trustItem"),
    isDraftModeEnabled(),
  ]);
  return { page, topics, draft };
});

export interface TrustTopicData {
  topic: TrustTopic;
  view: TrustTopicView;
  draft: boolean;
}

export const loadTrustTopic = cache(async (topic: string): Promise<TrustTopicData | null> => {
  if (!isTrustTopic(topic)) return null;
  const source = await getContentSource();
  const [view, draft] = await Promise.all([
    source.getDocument("trustItem", topic),
    isDraftModeEnabled(),
  ]);
  return view ? { topic, view, draft } : null;
});

export async function listTrustTopicParams(): Promise<{ topic: string }[]> {
  const source = await getPublishedContentSource();
  return (await source.listParams("trustItem")).flatMap((params) =>
    params.topic ? [{ topic: params.topic }] : [],
  );
}
