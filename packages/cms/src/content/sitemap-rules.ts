/**
 * Pure sitemap publication rules shared by every content source (repo, draft, fixtures and any
 * wrapper). No I/O, no framework imports; the clock is always injected as `today`.
 */
import { isSitemapEligible } from "./gates";
import type { PublicationGates } from "./gates";
import { labTypes, routes } from "../routes";
import type { SitemapEntry } from "./types";

const datePart = (value: string): string => value.slice(0, 10);
const nonEmpty = (value: string | null | undefined): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

/**
 * A job is open only while its `status` is `open` and its closing date (`validThrough`) has not
 * passed. `today` is the injected UTC calendar date (`YYYY-MM-DD`).
 *
 * Closing-date semantics: `validThrough` is inclusive. A role whose `validThrough` is today is
 * still open (it closes at the end of that day), matching the Careers gate count query
 * (`validThrough >= $today`). Only the date part is compared, so an ISO date-time is treated as
 * its calendar day. A role without a closing date stays open while its status is `open`.
 */
export function isJobOpenOn(
  job: { status?: string | null | undefined; validThrough?: string | null | undefined },
  today: string,
): boolean {
  if (job.status !== "open") return false;
  const validThrough = nonEmpty(job.validThrough);
  return validThrough === undefined || datePart(validThrough) >= today;
}

/** Closed or expired roles keep their page (marked closed) but are not listed in the sitemap. */
export const isJobSitemapEligible = isJobOpenOn;

export interface LabAssetSitemapInput {
  labType?: string | null | undefined;
  updatedAt?: string | null | undefined;
}

/**
 * `/labs/<type>` category entries: only while the Labs gate is open, and only for a known lab
 * type that has at least one sitemap-eligible asset (callers pass the assets they already list,
 * so noindex, non-public and unpublished assets never count). Types come out in canonical
 * `labTypes` order; `lastModified` is the newest asset update of that type.
 */
export function labTypeSitemapEntries(
  assets: readonly LabAssetSitemapInput[],
  gates: PublicationGates,
): SitemapEntry[] {
  if (!isSitemapEligible("labs", gates)) return [];
  const entries: SitemapEntry[] = [];
  for (const type of labTypes) {
    const ofType = assets.filter((asset) => asset.labType === type);
    if (ofType.length === 0) continue;
    const lastModified = ofType
      .map((asset) => nonEmpty(asset.updatedAt))
      .filter((value): value is string => value !== undefined)
      .sort()
      .at(-1);
    entries.push({
      path: routes.labType(type),
      kind: "route",
      ...(lastModified === undefined ? {} : { lastModified }),
    });
  }
  return entries;
}
