/**
 * Query lookup tables by document kind. Typegen only needs the `defineQuery` calls in the sibling
 * files; this file just groups them for the source.
 */
import type { DocKind } from "../content/types";
import {
  industryQuery,
  industrySummariesQuery,
  offerQuery,
  offerSummariesQuery,
  practiceQuery,
  practiceSummariesQuery,
  solutionQuery,
  solutionSummariesQuery,
} from "./commercial";
import {
  jobQuery,
  jobSummariesQuery,
  legalPageQuery,
  legalPageSummariesQuery,
  trustItemQuery,
  trustItemSummariesQuery,
} from "./institutional";
import {
  caseStudyQuery,
  caseStudySummariesQuery,
  insightQuery,
  insightSummariesQuery,
  labAssetQuery,
  labAssetSummariesQuery,
  personQuery,
  personSummariesQuery,
} from "./proof";

/** Detail query per kind (`$slug`; `$topic` for trust items; `$labType` too for lab assets). */
export const detailQueries: Record<DocKind, string> = {
  practice: practiceQuery,
  solution: solutionQuery,
  offer: offerQuery,
  industry: industryQuery,
  caseStudy: caseStudyQuery,
  insight: insightQuery,
  person: personQuery,
  labAsset: labAssetQuery,
  trustItem: trustItemQuery,
  job: jobQuery,
  legalPage: legalPageQuery,
};

/** Summaries query per kind; also the source of static params. */
export const summariesQueries: Record<DocKind, string> = {
  practice: practiceSummariesQuery,
  solution: solutionSummariesQuery,
  offer: offerSummariesQuery,
  industry: industrySummariesQuery,
  caseStudy: caseStudySummariesQuery,
  insight: insightSummariesQuery,
  person: personSummariesQuery,
  labAsset: labAssetSummariesQuery,
  trustItem: trustItemSummariesQuery,
  job: jobSummariesQuery,
  legalPage: legalPageSummariesQuery,
};

export {
  gateCountsQuery,
  homePageQuery,
  routePageQuery,
  siteSettingsQuery,
  sitemapQuery,
} from "./site";
