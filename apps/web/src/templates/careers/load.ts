import "server-only";
import { cache } from "react";
import type { JobSummary, JobView, PublicationGates, RoutePageView } from "@vitalos/cms";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource, getPublishedContentSource } from "../../lib/cms/get-content-source";

export interface CareersIndexData {
  page: RoutePageView | null;
  /** Open roles only (the content source lists no closed role). */
  jobs: JobSummary[];
  draft: boolean;
}

export const loadCareersIndex = cache(async (): Promise<CareersIndexData> => {
  const source = await getContentSource();
  const [page, jobs, draft] = await Promise.all([
    source.getRoutePage("careers"),
    source.listSummaries("job"),
    isDraftModeEnabled(),
  ]);
  return { page, jobs, draft };
});

export interface JobData {
  job: JobView;
  gates: PublicationGates;
  /** Request time, used to decide whether the role is still open. */
  now: Date;
  draft: boolean;
}

export const loadJob = cache(async (slug: string): Promise<JobData | null> => {
  const source = await getContentSource();
  const [job, gates, draft] = await Promise.all([
    source.getDocument("job", slug),
    source.getPublicationGates(),
    isDraftModeEnabled(),
  ]);
  return job ? { job, gates, now: new Date(), draft } : null;
});

export async function listJobParams(): Promise<{ slug: string }[]> {
  const source = await getPublishedContentSource();
  return (await source.listParams("job")).flatMap((params) =>
    params.slug ? [{ slug: params.slug }] : [],
  );
}
