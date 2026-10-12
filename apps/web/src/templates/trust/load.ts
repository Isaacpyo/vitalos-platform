import "server-only";
import { cache } from "react";
import type {
  TrustTopic,
  TrustTopicSummary,
  TrustTopicView,
  TrustOverviewView,
} from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";
import { isTrustTopic } from "./map";

export interface TrustOverviewData {
  page: TrustOverviewView | null;
  topics: TrustTopicSummary[];
}

export const loadTrustOverview = cache(async (): Promise<TrustOverviewData> => {
  const source = await getContentSource();
  const [page, topics] = await Promise.all([
    source.getRoutePage("trust"),
    source.listSummaries("trustItem"),
  ]);
  return { page, topics };
});

export interface TrustTopicData {
  topic: TrustTopic;
  view: TrustTopicView;
}

export const loadTrustTopic = cache(async (topic: string): Promise<TrustTopicData | null> => {
  if (!isTrustTopic(topic)) return null;
  const source = await getContentSource();
  const view = await source.getDocument("trustItem", topic);
  return view ? { topic, view } : null;
});

export async function listTrustTopicParams(): Promise<{ topic: string }[]> {
  const source = await getContentSource();
  return (await source.listParams("trustItem")).flatMap((params) =>
    params.topic ? [{ topic: params.topic }] : [],
  );
}
