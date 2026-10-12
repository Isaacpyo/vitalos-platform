import "server-only";
import { cache } from "react";
import type { JobSummary, JobView, PublicationGates, RoutePageView } from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";

export interface CareersIndexData {
  page: RoutePageView | null;
  /** Open roles only (the content source lists no closed role). */
  jobs: JobSummary[];
}

export const loadCareersIndex = cache(async (): Promise<CareersIndexData> => {
  const source = await getContentSource();
  const [page, jobs] = await Promise.all([
    source.getRoutePage("careers"),
    source.listSummaries("job"),
  ]);
  return { page, jobs };
});

export interface JobData {
  job: JobView;
  gates: PublicationGates;
  /** Request time, used to decide whether the role is still open. */
  now: Date;
}

export const loadJob = cache(async (slug: string): Promise<JobData | null> => {
  const source = await getContentSource();
  const [job, gates] = await Promise.all([
    source.getDocument("job", slug),
    source.getPublicationGates(),
  ]);
  return job ? { job, gates, now: new Date() } : null;
});

export async function listJobParams(): Promise<{ slug: string }[]> {
  const source = await getContentSource();
  return (await source.listParams("job")).flatMap((params) =>
    params.slug ? [{ slug: params.slug }] : [],
  );
}
