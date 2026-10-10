/**
 * Compile-time check that the raw shapes the mappers accept match what the generated query result
 * types say the projections return. If a projection changes, regenerate the types
 * (`pnpm check:cms-types --write`) and this file stops compiling until the mapper's raw type
 * follows. Runs under `tsc` (pnpm typecheck); the runtime test is a placeholder.
 */
import { describe, expect, it } from "vitest";
import type {
  CaseStudyQueryResult,
  CaseStudySummariesQueryResult,
  GateCountsQueryResult,
  HomePageQueryResult,
  IndustryQueryResult,
  InsightQueryResult,
  InsightSummariesQueryResult,
  JobQueryResult,
  JobSummariesQueryResult,
  LabAssetQueryResult,
  LabAssetSummariesQueryResult,
  LegalPageQueryResult,
  LegalPageSummariesQueryResult,
  OfferQueryResult,
  OfferSummariesQueryResult,
  PersonQueryResult,
  PersonSummariesQueryResult,
  PracticeQueryResult,
  PracticeSummariesQueryResult,
  RoutePageQueryResult,
  SiteSettingsQueryResult,
  SitemapQueryResult,
  SolutionQueryResult,
  SolutionSummariesQueryResult,
  TrustItemQueryResult,
  TrustItemSummariesQueryResult,
} from "../../generated/sanity.types";
import type {
  RawCaseStudy,
  RawCaseStudySummary,
  RawGateCounts,
  RawHomePage,
  RawIndustry,
  RawInsight,
  RawInsightSummary,
  RawJob,
  RawJobSummary,
  RawLabAsset,
  RawLabAssetSummary,
  RawLegalPage,
  RawLegalPageSummary,
  RawOffer,
  RawOfferSummary,
  RawPerson,
  RawPersonSummary,
  RawPractice,
  RawRoutePage,
  RawBasicSummary,
  RawSiteSettings,
  RawSitemap,
  RawSolution,
  RawTrustItem,
  RawTrustTopicSummary,
} from "./raw";

/** A generated query result must be assignable to the raw type the mapper takes. */
type Compatible<Result, Raw> = NonNullable<Result> extends Raw ? true : false;
/** Same, for a list result (`Array<...>`): every element must be assignable. */
type CompatibleList<Result, Raw> =
  NonNullable<Result> extends readonly (infer Item)[] ? (Item extends Raw ? true : false) : false;
const ok = <T extends true>(): T => true as T;

export const compatibility = [
  ok<Compatible<PracticeQueryResult, RawPractice>>(),
  ok<Compatible<SolutionQueryResult, RawSolution>>(),
  ok<Compatible<OfferQueryResult, RawOffer>>(),
  ok<Compatible<IndustryQueryResult, RawIndustry>>(),
  ok<Compatible<CaseStudyQueryResult, RawCaseStudy>>(),
  ok<Compatible<InsightQueryResult, RawInsight>>(),
  ok<Compatible<PersonQueryResult, RawPerson>>(),
  ok<Compatible<LabAssetQueryResult, RawLabAsset>>(),
  ok<Compatible<TrustItemQueryResult, RawTrustItem>>(),
  ok<Compatible<JobQueryResult, RawJob>>(),
  ok<Compatible<LegalPageQueryResult, RawLegalPage>>(),
  ok<Compatible<RoutePageQueryResult, RawRoutePage>>(),
  ok<Compatible<HomePageQueryResult, RawHomePage>>(),
  ok<Compatible<SiteSettingsQueryResult, RawSiteSettings>>(),
  ok<Compatible<GateCountsQueryResult, RawGateCounts>>(),
  ok<Compatible<SitemapQueryResult, RawSitemap>>(),
  ok<CompatibleList<PracticeSummariesQueryResult, RawBasicSummary>>(),
  ok<CompatibleList<SolutionSummariesQueryResult, RawBasicSummary>>(),
  ok<CompatibleList<OfferSummariesQueryResult, RawOfferSummary>>(),
  ok<CompatibleList<CaseStudySummariesQueryResult, RawCaseStudySummary>>(),
  ok<CompatibleList<InsightSummariesQueryResult, RawInsightSummary>>(),
  ok<CompatibleList<PersonSummariesQueryResult, RawPersonSummary>>(),
  ok<CompatibleList<LabAssetSummariesQueryResult, RawLabAssetSummary>>(),
  ok<CompatibleList<TrustItemSummariesQueryResult, RawTrustTopicSummary>>(),
  ok<CompatibleList<JobSummariesQueryResult, RawJobSummary>>(),
  ok<CompatibleList<LegalPageSummariesQueryResult, RawLegalPageSummary>>(),
];

describe("generated query result types", () => {
  it("match the raw shapes the mappers accept (checked by tsc)", () => {
    expect(compatibility.every(Boolean)).toBe(true);
  });
});
