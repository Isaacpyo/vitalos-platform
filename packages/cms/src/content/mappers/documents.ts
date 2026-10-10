/**
 * Detail mappers: raw projected document -> public view model, or `null` when the document may
 * not be public (wrong status, controlled, incomplete in a published read).
 */
import { isJobOpenOn } from "../sitemap-rules";
import { labTypes, legalSlugs, trustTopics } from "../../routes";
import { labMaturities } from "../types";
import type {
  CaseStudyView,
  IndustryView,
  InsightView,
  JobView,
  LabAssetView,
  LegalPageView,
  OfferView,
  OutcomeMetricView,
  PersonView,
  PracticeView,
  SolutionView,
  TestimonialView,
  TrustTopicView,
} from "../types";
import {
  clean,
  datePart,
  engagementBases,
  identifyDocument,
  isHttps,
  isLabPublic,
  isNamedClientPermitted,
  isPublicEvidence,
  isPublicStatus,
  isVerifiedPublicEvidence,
  list,
  mapCaseStudySummary,
  mapBasicSummary,
  mapCta,
  mapEvidence,
  mapImage,
  mapInsightSummary,
  mapOfferSummary,
  mapOptionalRichText,
  mapPersonSummary,
  mapRichText,
  mapSeo,
  mapSummaries,
  oneOf,
  stableId,
  strings,
  text,
} from "./common";
import type {
  Maybe,
  MapContext,
  RawCaseStudy,
  RawIndustry,
  RawInsight,
  RawJob,
  RawLabAsset,
  RawLegalPage,
  RawOffer,
  RawPerson,
  RawPractice,
  RawSolution,
  RawTrustItem,
} from "./raw";

/** Fields every detail view shares. Returns undefined when the document may not be public. */
function docBase(
  raw: Maybe<{
    id?: Maybe<string>;
    editorialStatus?: Maybe<string>;
    slug?: Maybe<string>;
    title?: Maybe<string>;
    summary?: Maybe<string>;
    updatedAt?: Maybe<string>;
    seo?: Maybe<Parameters<typeof mapSeo>[0]>;
  }>,
  ctx: MapContext,
) {
  const base = identifyDocument(raw, ctx);
  if (!base || !raw) return undefined;
  return { ...base, seo: mapSeo(raw.seo), updatedAt: text(raw.updatedAt) };
}

export function mapPractice(raw: Maybe<RawPractice>, ctx: MapContext): PracticeView | null {
  const base = docBase(raw, ctx);
  if (!base || !raw) return null;
  return clean<PracticeView>({
    ...base,
    proposition: text(raw.proposition) ?? "",
    problems: strings(raw.problems),
    capabilities: strings(raw.capabilities),
    body: mapOptionalRichText(raw.body, ctx),
    solutions: mapSummaries(raw.solutions, mapBasicSummary, ctx),
    offers: mapSummaries(raw.offers, mapOfferSummary, ctx),
    industries: mapSummaries(raw.industries, mapBasicSummary, ctx),
    work: mapSummaries(raw.work, mapCaseStudySummary, ctx),
    cta: mapCta(raw.cta, ctx),
  });
}

export function mapSolution(raw: Maybe<RawSolution>, ctx: MapContext): SolutionView | null {
  const base = docBase(raw, ctx);
  if (!base || !raw) return null;
  return clean<SolutionView>({
    ...base,
    problemStatement: text(raw.problemStatement) ?? "",
    signals: strings(raw.signals),
    impact: text(raw.impact),
    approach: mapOptionalRichText(raw.approach, ctx),
    phases: list(raw.phases).flatMap((phase) => {
      const title = text(phase.title);
      const description = text(phase.description);
      return title === undefined || description === undefined ? [] : [{ title, description }];
    }),
    offers: mapSummaries(raw.offers, mapOfferSummary, ctx),
    practices: mapSummaries(raw.practices, mapBasicSummary, ctx),
    industries: mapSummaries(raw.industries, mapBasicSummary, ctx),
    work: mapSummaries(raw.work, mapCaseStudySummary, ctx),
    faq: list(raw.faq).flatMap((item) => {
      const question = text(item.question);
      const answer = text(item.answer);
      return question === undefined || answer === undefined ? [] : [{ question, answer }];
    }),
    cta: mapCta(raw.cta, ctx),
  });
}

export function mapOffer(raw: Maybe<RawOffer>, ctx: MapContext): OfferView | null {
  const base = docBase(raw, ctx);
  if (!base || !raw) return null;
  return clean<OfferView>({
    ...base,
    audience: text(raw.audience) ?? "",
    trigger: text(raw.trigger) ?? "",
    scope: text(raw.scope) ?? "",
    outputs: strings(raw.outputs),
    requirements: strings(raw.requirements),
    durationCategory: text(raw.durationCategory) ?? "",
    exclusions: strings(raw.exclusions),
    nextStep: text(raw.nextStep) ?? "",
    solutions: mapSummaries(raw.solutions, mapBasicSummary, ctx),
    practices: mapSummaries(raw.practices, mapBasicSummary, ctx),
    cta: mapCta(raw.cta, ctx),
  });
}

export function mapIndustry(raw: Maybe<RawIndustry>, ctx: MapContext): IndustryView | null {
  const base = docBase(raw, ctx);
  if (!base || !raw) return null;
  return clean<IndustryView>({
    ...base,
    realities: strings(raw.realities),
    problems: strings(raw.problems),
    aiOpportunities: strings(raw.aiOpportunities),
    considerations: strings(raw.considerations),
    solutions: mapSummaries(raw.solutions, mapBasicSummary, ctx),
    offers: mapSummaries(raw.offers, mapOfferSummary, ctx),
    work: mapSummaries(raw.work, mapCaseStudySummary, ctx),
    insights: mapSummaries(raw.insights, mapInsightSummary, ctx),
    cta: mapCta(raw.cta, ctx),
  });
}

function mapMetrics(raw: RawCaseStudy["metrics"]): OutcomeMetricView[] {
  return list(raw).flatMap((metric) => {
    // Only verified, public, sourced numbers. No unsourced statistics (Stage 10 §17).
    if (!isVerifiedPublicEvidence(metric.evidence)) return [];
    const value = text(metric.value);
    const descriptor = text(metric.descriptor);
    const source = text(metric.source);
    if (value === undefined || descriptor === undefined || source === undefined) return [];
    return [
      clean<OutcomeMetricView>({
        value,
        descriptor,
        source,
        evidence: mapEvidence(metric.evidence),
        context: text(metric.context),
        timeframe: text(metric.timeframe),
      }),
    ];
  });
}

function mapTestimonial(raw: RawCaseStudy["testimonial"]): TestimonialView | undefined {
  // Permission must be granted and the quote attributed.
  if (!raw || raw.permissionStatus !== "granted") return undefined;
  const quote = text(raw.quote);
  const attribution = text(raw.attribution);
  if (quote === undefined || attribution === undefined) return undefined;
  return clean<TestimonialView>({ quote, attribution, role: text(raw.role) });
}

export function mapCaseStudy(raw: Maybe<RawCaseStudy>, ctx: MapContext): CaseStudyView | null {
  const base = docBase(raw, ctx);
  if (!base || !raw || !isPublicEvidence(raw.evidence)) return null;
  const engagementBasis = oneOf(engagementBases, raw.engagementBasis);
  if (engagementBasis === undefined) return null;
  const named = isNamedClientPermitted(raw);
  return clean<CaseStudyView>({
    ...base,
    engagementBasis,
    // A named client without verified permission is shown as anonymised.
    clientDisplay: named ? "named" : "anonymised",
    clientName: named ? text(raw.clientName) : undefined,
    sector: text(raw.sector),
    challenge: mapOptionalRichText(raw.challenge, ctx),
    approach: mapOptionalRichText(raw.approach, ctx),
    outcome: mapOptionalRichText(raw.outcome, ctx),
    metrics: mapMetrics(raw.metrics),
    testimonial: mapTestimonial(raw.testimonial),
    evidence: mapEvidence(raw.evidence),
    practices: mapSummaries(raw.practices, mapBasicSummary, ctx),
    solutions: mapSummaries(raw.solutions, mapBasicSummary, ctx),
    industries: mapSummaries(raw.industries, mapBasicSummary, ctx),
  });
}

export function mapInsight(raw: Maybe<RawInsight>, ctx: MapContext): InsightView | null {
  const base = docBase(raw, ctx);
  const publishedAt = text(raw?.publishedAt);
  if (!base || !raw || publishedAt === undefined) return null;
  const authors = mapSummaries(raw.authors, mapPersonSummary, ctx);
  // At least one named author is required (Stage 10 §18).
  if (authors.length === 0) return null;
  return clean<InsightView>({
    ...base,
    format: text(raw.format) ?? "",
    topics: strings(raw.topics),
    authors,
    publishedAt,
    body: mapRichText(raw.body, ctx),
    related: mapSummaries(raw.related, mapInsightSummary, ctx),
  });
}

export function mapPerson(raw: Maybe<RawPerson>, ctx: MapContext): PersonView | null {
  const base = docBase(raw, ctx);
  if (!base || !raw) return null;
  const name = text(raw.name) ?? text(raw.title);
  if (name === undefined) return null;
  return clean<PersonView>({
    ...base,
    // The person's title is their name (schema: no `title` field).
    title: name,
    name,
    role: text(raw.role),
    isLeadership: raw.isLeadership === true,
    bio: mapOptionalRichText(raw.bio, ctx),
    portrait: mapImage(raw.portrait),
    credentials: list(raw.credentials).flatMap((credential) => {
      const label = text(credential.label);
      return label === undefined || !isVerifiedPublicEvidence(credential.evidence)
        ? []
        : [{ label, evidence: mapEvidence(credential.evidence) }];
    }),
    // Verified, https profile links only.
    sameAs: list(raw.sameAs).flatMap((link) =>
      link.verified === true && isHttps(link.url) ? [link.url] : [],
    ),
    insights: mapSummaries(raw.insights, mapInsightSummary, ctx),
  });
}

export function mapLabAsset(raw: Maybe<RawLabAsset>, ctx: MapContext): LabAssetView | null {
  const base = docBase(raw, ctx);
  if (!base || !raw || !isLabPublic(raw)) return null;
  const labType = oneOf(labTypes, raw.labType);
  const maturity = oneOf(labMaturities, raw.maturity);
  if (labType === undefined || maturity === undefined) return null;
  const limitations = text(raw.limitations);
  // Every lab asset states its limitations; an asset without them is not published.
  if (limitations === undefined && !ctx.preview) return null;
  // Repository and demo links only for maintained assets.
  const maintained = raw.maintained === true;
  return clean<LabAssetView>({
    ...base,
    labType,
    maturity,
    is: text(raw.is),
    isNot: text(raw.isNot),
    limitations: limitations ?? "",
    body: mapOptionalRichText(raw.body, ctx),
    repoUrl: maintained && isHttps(raw.repoUrl) ? raw.repoUrl : undefined,
    demoUrl: maintained && isHttps(raw.demoUrl) ? raw.demoUrl : undefined,
  });
}

export function mapTrustItem(raw: Maybe<RawTrustItem>, ctx: MapContext): TrustTopicView | null {
  if (!raw || !isPublicStatus(raw.editorialStatus, ctx) || !isPublicEvidence(raw.evidence)) {
    return null;
  }
  const id = stableId(raw.id);
  const topic = oneOf(trustTopics, raw.topic);
  const title = text(raw.title);
  if (id === undefined || topic === undefined || title === undefined) return null;
  return clean<TrustTopicView>({
    id,
    topic,
    title,
    summary: text(raw.summary),
    seo: mapSeo(raw.seo),
    updatedAt: text(raw.updatedAt),
    publicSummary: mapOptionalRichText(raw.publicSummary, ctx),
    // Verified, public, scoped, dated and unexpired certifications only.
    certifications: list(raw.certifications).flatMap((certification) => {
      const name = text(certification.name);
      const scope = text(certification.scope);
      const issuedAt = text(certification.issuedAt);
      const expiresAt = text(certification.expiresAt);
      if (name === undefined || scope === undefined || issuedAt === undefined) return [];
      if (!isVerifiedPublicEvidence(certification.evidence)) return [];
      if (expiresAt !== undefined && datePart(expiresAt) < ctx.today) return [];
      return [
        clean<TrustTopicView["certifications"][number]>({ name, scope, issuedAt, expiresAt }),
      ];
    }),
    subprocessors: list(raw.subprocessors).flatMap((entry) => {
      const name = text(entry.name);
      const purpose = text(entry.purpose);
      return name === undefined || purpose === undefined
        ? []
        : [
            clean<TrustTopicView["subprocessors"][number]>({
              name,
              purpose,
              location: text(entry.location),
            }),
          ];
    }),
    contactEmail: text(raw.contactEmail),
  });
}

/** A job is open only while its status is open and `validThrough` has not passed (inclusive). */
export function isJobOpen(
  raw: { status?: Maybe<string>; validThrough?: Maybe<string> },
  ctx: MapContext,
): boolean {
  return isJobOpenOn(raw, ctx.today);
}

export function mapJob(raw: Maybe<RawJob>, ctx: MapContext): JobView | null {
  const base = docBase(raw, ctx);
  if (!base || !raw) return null;
  const open = isJobOpen(raw, ctx);
  return clean<JobView>({
    ...base,
    employmentType: text(raw.employmentType),
    location: text(raw.location),
    datePosted: text(raw.datePosted) ?? "",
    validThrough: text(raw.validThrough),
    status: open ? "open" : "closed",
    applicationUrl: open && isHttps(raw.applicationUrl) ? raw.applicationUrl : undefined,
    description: mapOptionalRichText(raw.description, ctx),
  });
}

export function mapLegalPage(raw: Maybe<RawLegalPage>, ctx: MapContext): LegalPageView | null {
  if (!raw || !isPublicStatus(raw.editorialStatus, ctx)) return null;
  const id = stableId(raw.id);
  const slug = oneOf(legalSlugs, raw.slug);
  const title = text(raw.title);
  if (id === undefined || slug === undefined || title === undefined) return null;
  return {
    id,
    slug,
    title,
    version: text(raw.version) ?? "",
    effectiveDate: text(raw.effectiveDate) ?? "",
    body: mapRichText(raw.body, ctx),
    seo: mapSeo(raw.seo),
  };
}
