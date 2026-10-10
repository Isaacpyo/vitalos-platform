import "server-only";
import { cache } from "react";
import type { ContentSource, PersonView, PublicationGates, RoutePageView } from "@vitalos/cms";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource } from "../../lib/cms/get-content-source";
import { leadershipOf } from "./map";

async function allPeople(source: ContentSource): Promise<PersonView[]> {
  const summaries = await source.listSummaries("person");
  const views = await Promise.all(summaries.map((s) => source.getDocument("person", s.slug)));
  return views.filter((view): view is PersonView => view !== null);
}

export interface AboutData {
  page: RoutePageView | null;
  leaders: PersonView[];
  gates: PublicationGates;
  draft: boolean;
}

export const loadAbout = cache(async (): Promise<AboutData> => {
  const source = await getContentSource();
  const [page, people, gates, draft] = await Promise.all([
    source.getRoutePage("about"),
    allPeople(source),
    source.getPublicationGates(),
    isDraftModeEnabled(),
  ]);
  return { page, leaders: leadershipOf(people), gates, draft };
});

export interface LeadershipData {
  page: RoutePageView | null;
  leaders: PersonView[];
  draft: boolean;
}

export const loadLeadership = cache(async (): Promise<LeadershipData> => {
  const source = await getContentSource();
  const [page, people, draft] = await Promise.all([
    source.getRoutePage("leadership"),
    allPeople(source),
    isDraftModeEnabled(),
  ]);
  return { page, leaders: leadershipOf(people), draft };
});
