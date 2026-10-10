/**
 * Shapes of the query results the mappers consume (what the projections in `queries/` return).
 *
 * GROQ yields `null` for anything missing, so every optional value is `Maybe<T>`. The raw shapes
 * deliberately carry the fields a mapper needs to re-check public safety (editorial status,
 * evidence classification, rights, permission, verification) but never an evidence pointer,
 * evidence owner or permission evidence.
 */

export type Maybe<T> = T | null | undefined;

/** What the current read may show; the source builds it from the same params the query used. */
export interface MapContext {
  /** Editorial statuses that may be public for this read. */
  statuses: readonly string[];
  /** YYYY-MM-DD in UTC, for expiry checks. */
  today: string;
  /** Draft-mode read: incomplete documents are shown rather than dropped. */
  preview: boolean;
}

export interface RawImage {
  url?: Maybe<string>;
  alt?: Maybe<string>;
  decorative?: Maybe<boolean>;
  credit?: Maybe<string>;
  rightsStatus?: Maybe<string>;
  width?: Maybe<number>;
  height?: Maybe<number>;
}

export interface RawEvidence {
  evidenceStatus?: Maybe<string>;
  classification?: Maybe<string>;
  verifiedAt?: Maybe<string>;
}

export interface RawSeo {
  title?: Maybe<string>;
  description?: Maybe<string>;
  noindex?: Maybe<boolean>;
  ogImage?: Maybe<RawImage>;
}

export interface RawRefTarget {
  _type?: Maybe<string>;
  slug?: Maybe<string>;
  topic?: Maybe<string>;
  labType?: Maybe<string>;
  editorialStatus?: Maybe<string>;
  classification?: Maybe<string>;
}

export interface RawCta {
  label?: Maybe<string>;
  intent?: Maybe<string>;
  routeKey?: Maybe<string>;
  target?: Maybe<RawRefTarget>;
}

/** A Portable Text block as projected (figure images and internal link targets resolved). */
export interface RawBlock {
  _type?: Maybe<string>;
  _key?: Maybe<string>;
  [field: string]: unknown;
}
export type RawRichText = Maybe<readonly Maybe<RawBlock>[]>;

export interface RawIdentity {
  id?: Maybe<string>;
  editorialStatus?: Maybe<string>;
  slug?: Maybe<string>;
  title?: Maybe<string>;
  summary?: Maybe<string>;
}

export interface RawDocBase extends RawIdentity {
  updatedAt?: Maybe<string>;
  seo?: Maybe<RawSeo>;
}

/* ---------- Summaries ---------- */

export type RawBasicSummary = RawIdentity;
export interface RawOfferSummary extends RawIdentity {
  durationCategory?: Maybe<string>;
}
export interface RawCaseStudySummary extends RawIdentity {
  engagementBasis?: Maybe<string>;
  clientDisplay?: Maybe<string>;
  anonymisedDescriptor?: Maybe<string>;
  namedPermitted?: Maybe<boolean>;
  clientName?: Maybe<string>;
  evidence?: Maybe<RawEvidence>;
}
export interface RawPersonSummary extends RawIdentity {
  role?: Maybe<string>;
  portrait?: Maybe<RawImage>;
}
export interface RawInsightSummary extends RawIdentity {
  format?: Maybe<string>;
  publishedAt?: Maybe<string>;
  authors?: Maybe<readonly Maybe<RawPersonSummary>[]>;
}
export interface RawLabAssetSummary extends RawIdentity {
  labType?: Maybe<string>;
  maturity?: Maybe<string>;
  supportVerified?: Maybe<boolean>;
  evidence?: Maybe<RawEvidence>;
}
export interface RawTrustTopicSummary {
  id?: Maybe<string>;
  editorialStatus?: Maybe<string>;
  topic?: Maybe<string>;
  title?: Maybe<string>;
  summary?: Maybe<string>;
  evidence?: Maybe<RawEvidence>;
}
export interface RawJobSummary extends RawIdentity {
  location?: Maybe<string>;
  employmentType?: Maybe<string>;
  status?: Maybe<string>;
  validThrough?: Maybe<string>;
  datePosted?: Maybe<string>;
}
export type RawLegalPageSummary = RawIdentity;

/* ---------- Documents ---------- */

export interface RawMetric {
  value?: Maybe<string>;
  descriptor?: Maybe<string>;
  source?: Maybe<string>;
  context?: Maybe<string>;
  timeframe?: Maybe<string>;
  evidence?: Maybe<RawEvidence>;
}

export interface RawTestimonial {
  quote?: Maybe<string>;
  attribution?: Maybe<string>;
  role?: Maybe<string>;
  permissionStatus?: Maybe<string>;
}

export interface RawPractice extends RawDocBase {
  proposition?: Maybe<string>;
  problems?: Maybe<readonly Maybe<string>[]>;
  capabilities?: Maybe<readonly Maybe<string>[]>;
  body?: RawRichText;
  solutions?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  offers?: Maybe<readonly Maybe<RawOfferSummary>[]>;
  industries?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  work?: Maybe<readonly Maybe<RawCaseStudySummary>[]>;
  cta?: Maybe<RawCta>;
}

export interface RawSolution extends RawDocBase {
  problemStatement?: Maybe<string>;
  signals?: Maybe<readonly Maybe<string>[]>;
  impact?: Maybe<string>;
  approach?: RawRichText;
  phases?: Maybe<readonly Maybe<{ title?: Maybe<string>; description?: Maybe<string> }>[]>;
  offers?: Maybe<readonly Maybe<RawOfferSummary>[]>;
  practices?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  industries?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  work?: Maybe<readonly Maybe<RawCaseStudySummary>[]>;
  faq?: Maybe<readonly Maybe<{ question?: Maybe<string>; answer?: Maybe<string> }>[]>;
  cta?: Maybe<RawCta>;
}

export interface RawOffer extends RawDocBase {
  audience?: Maybe<string>;
  trigger?: Maybe<string>;
  scope?: Maybe<string>;
  outputs?: Maybe<readonly Maybe<string>[]>;
  requirements?: Maybe<readonly Maybe<string>[]>;
  durationCategory?: Maybe<string>;
  exclusions?: Maybe<readonly Maybe<string>[]>;
  nextStep?: Maybe<string>;
  solutions?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  practices?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  cta?: Maybe<RawCta>;
}

export interface RawIndustry extends RawDocBase {
  realities?: Maybe<readonly Maybe<string>[]>;
  problems?: Maybe<readonly Maybe<string>[]>;
  aiOpportunities?: Maybe<readonly Maybe<string>[]>;
  considerations?: Maybe<readonly Maybe<string>[]>;
  solutions?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  offers?: Maybe<readonly Maybe<RawOfferSummary>[]>;
  work?: Maybe<readonly Maybe<RawCaseStudySummary>[]>;
  insights?: Maybe<readonly Maybe<RawInsightSummary>[]>;
  cta?: Maybe<RawCta>;
}

export interface RawCaseStudy extends RawDocBase {
  engagementBasis?: Maybe<string>;
  clientDisplay?: Maybe<string>;
  anonymisedDescriptor?: Maybe<string>;
  namedPermitted?: Maybe<boolean>;
  clientName?: Maybe<string>;
  sector?: Maybe<string>;
  challenge?: RawRichText;
  approach?: RawRichText;
  outcome?: RawRichText;
  metrics?: Maybe<readonly Maybe<RawMetric>[]>;
  testimonial?: Maybe<RawTestimonial>;
  evidence?: Maybe<RawEvidence>;
  practices?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  solutions?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  industries?: Maybe<readonly Maybe<RawBasicSummary>[]>;
}

export interface RawInsight extends RawDocBase {
  format?: Maybe<string>;
  topics?: Maybe<readonly Maybe<string>[]>;
  authors?: Maybe<readonly Maybe<RawPersonSummary>[]>;
  publishedAt?: Maybe<string>;
  body?: RawRichText;
  related?: Maybe<readonly Maybe<RawInsightSummary>[]>;
}

export interface RawPerson extends RawDocBase {
  name?: Maybe<string>;
  role?: Maybe<string>;
  isLeadership?: Maybe<boolean>;
  bio?: RawRichText;
  portrait?: Maybe<RawImage>;
  credentials?: Maybe<readonly Maybe<{ label?: Maybe<string>; evidence?: Maybe<RawEvidence> }>[]>;
  sameAs?: Maybe<
    readonly Maybe<{ label?: Maybe<string>; url?: Maybe<string>; verified?: Maybe<boolean> }>[]
  >;
  insights?: Maybe<readonly Maybe<RawInsightSummary>[]>;
}

export interface RawLabAsset extends RawDocBase {
  labType?: Maybe<string>;
  maturity?: Maybe<string>;
  is?: Maybe<string>;
  isNot?: Maybe<string>;
  limitations?: Maybe<string>;
  body?: RawRichText;
  maintained?: Maybe<boolean>;
  repoUrl?: Maybe<string>;
  demoUrl?: Maybe<string>;
  supportVerified?: Maybe<boolean>;
  evidence?: Maybe<RawEvidence>;
}

export interface RawTrustItem {
  id?: Maybe<string>;
  editorialStatus?: Maybe<string>;
  topic?: Maybe<string>;
  title?: Maybe<string>;
  summary?: Maybe<string>;
  updatedAt?: Maybe<string>;
  seo?: Maybe<RawSeo>;
  evidence?: Maybe<RawEvidence>;
  publicSummary?: RawRichText;
  certifications?: Maybe<
    readonly Maybe<{
      name?: Maybe<string>;
      scope?: Maybe<string>;
      issuedAt?: Maybe<string>;
      expiresAt?: Maybe<string>;
      evidence?: Maybe<RawEvidence>;
    }>[]
  >;
  subprocessors?: Maybe<
    readonly Maybe<{
      name?: Maybe<string>;
      purpose?: Maybe<string>;
      location?: Maybe<string>;
    }>[]
  >;
  contactEmail?: Maybe<string>;
}

export interface RawJob extends RawDocBase {
  employmentType?: Maybe<string>;
  location?: Maybe<string>;
  datePosted?: Maybe<string>;
  validThrough?: Maybe<string>;
  status?: Maybe<string>;
  applicationUrl?: Maybe<string>;
  description?: RawRichText;
}

export interface RawLegalPage {
  id?: Maybe<string>;
  editorialStatus?: Maybe<string>;
  slug?: Maybe<string>;
  title?: Maybe<string>;
  version?: Maybe<string>;
  effectiveDate?: Maybe<string>;
  body?: RawRichText;
  seo?: Maybe<RawSeo>;
}

/* ---------- Singletons ---------- */

export interface RawSiteSettings {
  editorialStatus?: Maybe<string>;
  legalName?: Maybe<string>;
  companyNumber?: Maybe<string>;
  registeredAddress?: Maybe<string>;
  contactEmail?: Maybe<string>;
  securityEmail?: Maybe<string>;
  social?: Maybe<
    readonly Maybe<{ label?: Maybe<string>; href?: Maybe<string>; verified?: Maybe<boolean> }>[]
  >;
  defaultSeo?: Maybe<RawSeo>;
  logo?: Maybe<RawImage>;
}

export interface RawRoutePage {
  editorialStatus?: Maybe<string>;
  key?: Maybe<string>;
  heading?: Maybe<string>;
  intro?: Maybe<string>;
  body?: RawRichText;
  seo?: Maybe<RawSeo>;
  cta?: Maybe<RawCta>;
  expectations?: RawRichText;
  successMessage?: Maybe<string>;
  routes?: Maybe<
    readonly Maybe<{
      intent?: Maybe<string>;
      label?: Maybe<string>;
      description?: Maybe<string>;
    }>[]
  >;
}

export interface RawHomePage {
  editorialStatus?: Maybe<string>;
  seo?: Maybe<RawSeo>;
  homeSections?: Maybe<
    readonly Maybe<{ sectionKey?: Maybe<string>; visibleHeading?: Maybe<string> }>[]
  >;
  proof?: Maybe<
    readonly Maybe<{ label?: Maybe<string>; href?: Maybe<string>; evidence?: Maybe<RawEvidence> }>[]
  >;
  solutions?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  practices?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  selectedWork?: Maybe<readonly Maybe<RawCaseStudySummary>[]>;
  industries?: Maybe<readonly Maybe<RawBasicSummary>[]>;
  labs?: Maybe<readonly Maybe<RawLabAssetSummary>[]>;
  insights?: Maybe<readonly Maybe<RawInsightSummary>[]>;
  leadership?: Maybe<readonly Maybe<RawPersonSummary>[]>;
  trustHighlights?: Maybe<readonly Maybe<RawTrustTopicSummary>[]>;
  finalCta?: Maybe<RawCta>;
}

export interface RawGateCounts {
  work?: Maybe<number>;
  insights?: Maybe<number>;
  labs?: Maybe<number>;
  industries?: Maybe<number>;
  careers?: Maybe<number>;
}

export interface RawSitemapEntry {
  slug?: Maybe<string>;
  topic?: Maybe<string>;
  labType?: Maybe<string>;
  updatedAt?: Maybe<string>;
  noindex?: Maybe<boolean>;
  editorialStatus?: Maybe<string>;
  classification?: Maybe<string>;
}
export type RawSitemap = Partial<Record<string, Maybe<readonly Maybe<RawSitemapEntry>[]>>>;
