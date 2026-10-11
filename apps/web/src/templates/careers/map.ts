import { navLabels, routes } from "@vitalos/cms";
import type { JobSummary, JobView } from "@vitalos/cms";
import type { MetaItem, PatternLink } from "@vitalos/ui";
import { humanise, isHttpsUrl } from "../institutional/format";

/** Job view models to display data. Pure and framework-free. */

/** Structural labels (Stage 8 §19 "Job SEO": location, employment type, posting dates). */
export const careersLabels = {
  location: "Location",
  employmentType: "Employment type",
  posted: "Posted",
  closes: "Closing date",
  closed: "This role is closed",
  apply: "Apply for this role",
} as const;

const dayOf = (value: string) => value.slice(0, 10);

/**
 * A role is open when its status says so and its closing date, if any, has not passed. `now` is
 * injectable. A role that is not open keeps its page but is shown as closed and gets no
 * structured data.
 */
export function isOpenRole(job: Pick<JobView, "status" | "validThrough">, now: Date): boolean {
  if (job.status !== "open") return false;
  if (!job.validThrough) return true;
  return dayOf(job.validThrough) >= now.toISOString().slice(0, 10);
}

export const employmentTypeLabel = (value: string | undefined): string | undefined =>
  value?.trim() ? humanise(value) : undefined;

/** Location and employment type as labelled facts (summary level, for list rows). */
export function summaryFacts(job: JobSummary): MetaItem[] {
  const facts: MetaItem[] = [];
  if (job.location?.trim()) facts.push({ label: careersLabels.location, value: job.location });
  const type = employmentTypeLabel(job.employmentType);
  if (type) facts.push({ label: careersLabels.employmentType, value: type });
  return facts;
}

/** The application action: the role's own https application URL, else the careers contact route. */
export function applyLink(job: JobView): PatternLink & { external: boolean } {
  return isHttpsUrl(job.applicationUrl)
    ? { label: careersLabels.apply, href: job.applicationUrl, external: true }
    : { label: navLabels.contact, href: routes.contact("careers"), external: false };
}
