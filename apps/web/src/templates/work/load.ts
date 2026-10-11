import "server-only";
import { cache } from "react";
import type { CaseStudyView, ContentSource, PublicationGates, RoutePageView } from "@vitalos/cms";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource, getPublishedContentSource } from "../../lib/cms/get-content-source";
import { isPublicCaseStudy } from "./map";

/** Case studies with verified evidence, in source order. Drafts and pending proof are not Work. */
async function publicCaseStudies(source: ContentSource, draft: boolean): Promise<CaseStudyView[]> {
  const summaries = await source.listSummaries("caseStudy");
  const views = await Promise.all(summaries.map((s) => source.getDocument("caseStudy", s.slug)));
  return views.filter(
    (view): view is CaseStudyView => view !== null && (draft || isPublicCaseStudy(view)),
  );
}

export interface WorkIndexData {
  page: RoutePageView | null;
  studies: CaseStudyView[];
  draft: boolean;
}

export const loadWorkIndex = cache(async (): Promise<WorkIndexData> => {
  const source = await getContentSource();
  const draft = await isDraftModeEnabled();
  const [page, studies] = await Promise.all([
    source.getRoutePage("work"),
    publicCaseStudies(source, draft),
  ]);
  return { page, studies, draft };
});

export interface CaseStudyData {
  study: CaseStudyView;
  gates: PublicationGates;
  draft: boolean;
}

/** Null (a 404) for a missing case study or one without verified evidence (outside Draft Mode). */
export const loadCaseStudy = cache(async (slug: string): Promise<CaseStudyData | null> => {
  const source = await getContentSource();
  const [study, gates, draft] = await Promise.all([
    source.getDocument("caseStudy", slug),
    source.getPublicationGates(),
    isDraftModeEnabled(),
  ]);
  if (!study || (!draft && !isPublicCaseStudy(study))) return null;
  return { study, gates, draft };
});

export async function listCaseStudyParams(): Promise<{ slug: string }[]> {
  const source = await getPublishedContentSource();
  return (await publicCaseStudies(source, false)).map((study) => ({ slug: study.slug }));
}
