import "server-only";
import { cache } from "react";
import type { CaseStudyView, ContentSource, PublicationGates, RoutePageView } from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";
import { isPublicCaseStudy } from "./map";

/** Case studies with verified evidence, in source order. Drafts and pending proof are not Work. */
async function publicCaseStudies(source: ContentSource): Promise<CaseStudyView[]> {
  const summaries = await source.listSummaries("caseStudy");
  const views = await Promise.all(summaries.map((s) => source.getDocument("caseStudy", s.slug)));
  return views.filter((view): view is CaseStudyView => view !== null && isPublicCaseStudy(view));
}

export interface WorkIndexData {
  page: RoutePageView | null;
  studies: CaseStudyView[];
}

export const loadWorkIndex = cache(async (): Promise<WorkIndexData> => {
  const source = await getContentSource();
  const [page, studies] = await Promise.all([
    source.getRoutePage("work"),
    publicCaseStudies(source),
  ]);
  return { page, studies };
});

export interface CaseStudyData {
  study: CaseStudyView;
  gates: PublicationGates;
}

/** Null (a 404) for a missing case study or one without verified evidence. */
export const loadCaseStudy = cache(async (slug: string): Promise<CaseStudyData | null> => {
  const source = await getContentSource();
  const [study, gates] = await Promise.all([
    source.getDocument("caseStudy", slug),
    source.getPublicationGates(),
  ]);
  if (!study || !isPublicCaseStudy(study)) return null;
  return { study, gates };
});

export async function listCaseStudyParams(): Promise<{ slug: string }[]> {
  const source = await getContentSource();
  return (await publicCaseStudies(source)).map((study) => ({ slug: study.slug }));
}
