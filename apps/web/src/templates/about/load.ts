import "server-only";
import { cache } from "react";
import type { ContentSource, PersonView, PublicationGates, RoutePageView } from "@vitalos/cms";
import { loadChromeContent } from "../../components/site-chrome/load";
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
}

export const loadAbout = cache(async (): Promise<AboutData> => {
  const source = await getContentSource();
  // Gates from the chrome: Careers follows the Super Admin's `careers_open` (ADR-035).
  const [page, people, { gates }] = await Promise.all([
    source.getRoutePage("about"),
    allPeople(source),
    loadChromeContent(),
  ]);
  return { page, leaders: leadershipOf(people), gates };
});

export interface LeadershipData {
  page: RoutePageView | null;
  leaders: PersonView[];
}

export const loadLeadership = cache(async (): Promise<LeadershipData> => {
  const source = await getContentSource();
  const [page, people] = await Promise.all([source.getRoutePage("leadership"), allPeople(source)]);
  return { page, leaders: leadershipOf(people) };
});
