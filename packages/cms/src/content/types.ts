/**
 * Public view models: the only content shapes the web app renders.
 *
 * These are framework-free. Content sources (repo, draft, fixtures) produce these shapes and are
 * responsible for excluding anything that must not be public:
 * controlled evidence, archived documents, unverified certifications, testimonials without
 * permission and images without approved rights. A view never carries an internal evidence
 * pointer.
 */
import type { PublicationGates } from "./gates";
import type { HomeSectionKey } from "../locked-copy";
import type {
  ContactIntent,
  LabType,
  LegalSlug,
  RoutedDocKind,
  RoutePageKey,
  TrustTopic,
} from "../routes";

export type DocKind = RoutedDocKind;

export const labMaturities = [
  "research",
  "concept",
  "prototype",
  "accelerator",
  "beta",
  "production-product",
] as const;
export type LabMaturity = (typeof labMaturities)[number];

/** ISO 8601 date or date-time string. */
export type IsoDate = string;

/**
 * Editorial status of a document (Website Build Pack, 25 Oct 2026). Absent means published, so
 * every document that predates the field keeps its behaviour. The repo source serves only
 * published documents in production; previews and local builds also serve drafts and approved
 * documents, with a draft notice, so the owner can review them before approving publication.
 */
export const publishStatuses = ["draft", "approved", "published"] as const;
export type PublishStatus = (typeof publishStatuses)[number];

/** True for a document (or summary, or block) that is not yet published. */
export const isUnpublished = (item: { publishStatus?: PublishStatus | undefined }): boolean =>
  item.publishStatus !== undefined && item.publishStatus !== "published";

/** Portable-text-like blocks; rendered by the web app's rich-text component. */
export interface RichTextBlock {
  _type: string;
  _key?: string;
  [field: string]: unknown;
}
export type RichText = readonly RichTextBlock[];

export interface ImageView {
  url: string;
  /** Required unless `decorative`. */
  alt: string;
  decorative?: boolean;
  width: number;
  height: number;
  credit?: string;
}

export interface SeoView {
  title?: string;
  description?: string;
  noindex?: boolean;
  ogImage?: ImageView;
}

export type CtaIntent = ContactIntent | "explore" | "read" | "download";

export interface CtaView {
  label: string;
  /** Resolved route from routes.ts, or a vetted https URL. */
  href: string;
  intent?: CtaIntent;
}

export interface EvidenceView {
  status: "verified" | "pending" | "n/a";
  verifiedAt?: IsoDate;
}

/** A sourced statistic. `source` is mandatory: no unsourced numbers. */
export interface StatView {
  value: string;
  descriptor: string;
  source: string;
  evidence?: EvidenceView;
}

export interface OutcomeMetricView extends StatView {
  context?: string;
  timeframe?: string;
  /**
   * Who verified the figure (Website Build Pack, 25 Oct 2026), for example "Clinic practice
   * manager, in writing". A metric without a source and a verifier is never shown.
   */
  verifiedBy?: string;
}

export interface TestimonialView {
  quote: string;
  /** Required: no anonymous quotes. */
  attribution: string;
  role?: string;
  /** Date the person gave written permission to publish the quote. Without it, it is never shown. */
  permissionDate?: IsoDate;
}

/* ---------- Site chrome ---------- */

export interface SocialLinkView {
  label: string;
  href: string;
}

/** Owner-supplied podcast listing URLs (https, open.spotify.com / podcasts.apple.com only). */
export interface PodcastLinksView {
  spotifyUrl?: string;
  appleUrl?: string;
}

export interface SiteSettingsView {
  legalName?: string;
  companyNumber?: string;
  registeredAddress?: string;
  contactEmail?: string;
  securityEmail?: string;
  /** Rendered in the footer only when at least one valid URL is set. */
  podcast?: PodcastLinksView;
  /** Only verified channels. */
  social?: readonly SocialLinkView[];
  defaultSeo?: SeoView;
  logo?: { src: string; width: number; height: number; alt?: string };
}

export interface SiteChromeView {
  settings: SiteSettingsView;
  gates: PublicationGates;
}

/* ---------- Summaries ---------- */

interface SummaryBase {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  /** Set only by the draft content source (ADR-025): illustrative placeholder content. */
  placeholder?: true;
  /** Absent means published (see `PublishStatus`). */
  publishStatus?: PublishStatus;
}

export type PracticeSummary = SummaryBase;
export type SolutionSummary = SummaryBase;
export type IndustrySummary = SummaryBase;
export interface OfferSummary extends SummaryBase {
  durationCategory?: string;
}
export interface CaseStudySummary extends SummaryBase {
  engagementBasis: EngagementBasis;
  clientLabel?: string;
  kind?: CaseStudyKind;
}
export interface InsightSummary extends SummaryBase {
  format: string;
  publishedAt: IsoDate;
  authors: readonly PersonSummary[];
}
export interface PersonSummary extends SummaryBase {
  role?: string;
  portrait?: ImageView;
}
export interface LabAssetSummary extends SummaryBase {
  labType: LabType;
  maturity: LabMaturity;
}
export interface TrustTopicSummary {
  id: string;
  topic: TrustTopic;
  title: string;
  summary?: string;
}
export interface JobSummary extends SummaryBase {
  location?: string;
  employmentType?: string;
}
export interface LegalPageSummary {
  id: string;
  slug: LegalSlug;
  title: string;
}

/* ---------- Documents ---------- */

interface DocBase {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  /**
   * Set only by the draft content source (ADR-025): the document is invented placeholder content
   * that must be replaced before launch. Never produced by the fixtures.
   */
  placeholder?: true;
  /** Absent means published. Unpublished documents are never served in production. */
  publishStatus?: PublishStatus;
  seo: SeoView;
  updatedAt?: IsoDate;
}

export interface PracticeView extends DocBase {
  proposition: string;
  problems: readonly string[];
  capabilities: readonly string[];
  body?: RichText;
  solutions: readonly SolutionSummary[];
  offers: readonly OfferSummary[];
  industries: readonly IndustrySummary[];
  work: readonly CaseStudySummary[];
  cta?: CtaView;
}

export interface SolutionView extends DocBase {
  problemStatement: string;
  signals: readonly string[];
  impact?: string;
  approach?: RichText;
  phases: readonly { title: string; description: string }[];
  /** At least one offer is required before a solution may publish (Stage 10 §15). */
  offers: readonly OfferSummary[];
  practices: readonly PracticeSummary[];
  industries: readonly IndustrySummary[];
  work: readonly CaseStudySummary[];
  faq: readonly { question: string; answer: string }[];
  cta?: CtaView;
}

/** Offers deliberately carry no price field (Stage 8 §12). */
export interface OfferView extends DocBase {
  audience: string;
  trigger: string;
  scope: string;
  outputs: readonly string[];
  requirements: readonly string[];
  durationCategory: string;
  exclusions: readonly string[];
  nextStep: string;
  solutions: readonly SolutionSummary[];
  practices: readonly PracticeSummary[];
  cta?: CtaView;
  /**
   * The points layout (Website Build Pack, 25 Oct 2026): who it is for and the triggers as short
   * points of eight words or fewer, rendered with icons instead of the engagement paragraphs. When
   * present, `audience` and `trigger` still hold the same words as plain text for search and Relay.
   */
  audiencePoints?: readonly string[];
  triggerPoints?: readonly string[];
  /** A finer duration than the category, shown beside it, for example "2 weeks". */
  durationDetail?: string;
  /** Case studies that link to this offer. */
  work?: readonly CaseStudySummary[];
}

export interface IndustryView extends DocBase {
  realities: readonly string[];
  problems: readonly string[];
  aiOpportunities: readonly string[];
  considerations: readonly string[];
  solutions: readonly SolutionSummary[];
  offers: readonly OfferSummary[];
  work: readonly CaseStudySummary[];
  insights: readonly InsightSummary[];
  cta?: CtaView;
  /**
   * The industry's lead page (Website Build Pack, 25 Oct 2026). When present it replaces the
   * standard industry page at the same URL. It carries its own `publishStatus`, so production
   * keeps serving the standard page until the owner approves the lead page.
   */
  landing?: IndustryLandingView;
}

/**
 * One short point of a lead page: a line of eight words or fewer, or a card (title, line, an
 * optional short fact and link). `key` names the point's subject; the web app picks its icon by
 * it, so content never carries presentation.
 */
export interface LandingPoint {
  key: string;
  text: string;
  title?: string;
  /** A short fact beside the title, for example a duration. */
  meta?: string;
  href?: string;
}

/** A headed group of points on a lead page. */
export interface LandingSection {
  heading: string;
  /** In-page anchor, when other links point at the section (for example "offers"). */
  anchor?: string;
  points: readonly LandingPoint[];
}

/** The copy of an industry lead page: short points only (long text belongs in Insights). */
export interface IndustryLandingView {
  publishStatus?: PublishStatus;
  seo: SeoView;
  eyebrow: string;
  heading: string;
  lead: string;
  primaryCta: CtaView;
  secondaryCta: CtaView;
  painPoints: LandingSection;
  offers: LandingSection;
  steps: LandingSection;
  /** What AI does (`does`) and never does (`doesNot`), with a link to the briefing on the line. */
  guardrails: {
    heading: string;
    does: readonly LandingPoint[];
    doesNot: readonly LandingPoint[];
    /** Shown in production only once the linked Insight is published. */
    link?: CtaView & { insightSlug: string };
  };
  pilots: LandingSection & { cta: CtaView };
  trust: LandingSection;
  caseStudies: {
    heading: string;
    /** The card shown while no case study of this industry is published. */
    fallback: LandingPoint;
  };
  insights: {
    heading: string;
    /** The Insights topic or sector whose latest posts are listed. */
    topicSlug: string;
  };
  faq: readonly { question: string; answer: string }[];
  closing: { heading: string; primary: CtaView; secondary: CtaView };
}

/**
 * `vitalos-product`: a product Vitalos built and runs, told as a case study ("Built and run by
 * Vitalos"; Website Build Pack, 25 Oct 2026).
 */
export type EngagementBasis = "contracted-by-vitalos" | "prior-team-experience" | "vitalos-product";

/** A client engagement, or a product Vitalos built and runs. */
export type CaseStudyKind = "client" | "product";

export interface CaseStudyView extends DocBase {
  engagementBasis: EngagementBasis;
  /** Absent means a client engagement. A product story carries basis `vitalos-product`. */
  kind?: CaseStudyKind;
  clientDisplay: "named" | "anonymised";
  /** Present only when `clientDisplay` is "named" and permission evidence is verified. */
  clientName?: string;
  /**
   * Date of the client's written permission to be named. Without it the client is never named and
   * no logo is shown, whatever `clientDisplay` says.
   */
  clientPermission?: IsoDate;
  /** Three points of eight words or fewer above the story, each with an icon (by `key`). */
  highlights?: readonly LandingPoint[];
  /** What the case study's own visual shows; its draft alt text until the image exists. */
  visual?: string;
  /** Offers the work relates to (cross-links). */
  offers?: readonly OfferSummary[];
  /** Slugs of the Vitalos products involved (`products.ts`). */
  products?: readonly string[];
  sector?: string;
  challenge?: RichText;
  approach?: RichText;
  outcome?: RichText;
  metrics: readonly OutcomeMetricView[];
  testimonial?: TestimonialView;
  evidence: EvidenceView;
  practices: readonly PracticeSummary[];
  solutions: readonly SolutionSummary[];
  industries: readonly IndustrySummary[];
}

export interface InsightView extends DocBase {
  format: string;
  topics: readonly string[];
  /** At least one named author (Stage 10 §18). */
  authors: readonly PersonSummary[];
  publishedAt: IsoDate;
  body: RichText;
  related: readonly InsightSummary[];
}

export interface PersonView extends DocBase {
  name: string;
  role?: string;
  isLeadership: boolean;
  bio?: RichText;
  portrait?: ImageView;
  credentials: readonly { label: string; evidence: EvidenceView }[];
  /** Verified profile links only. */
  sameAs: readonly string[];
  insights: readonly InsightSummary[];
}

export interface LabAssetView extends DocBase {
  labType: LabType;
  maturity: LabMaturity;
  is?: string;
  isNot?: string;
  /** Required: every lab asset states its limitations. */
  limitations: string;
  body?: RichText;
  /** Only when the asset is maintained. */
  repoUrl?: string;
  demoUrl?: string;
}

export interface TrustTopicView {
  id: string;
  topic: TrustTopic;
  title: string;
  summary?: string;
  seo: SeoView;
  updatedAt?: IsoDate;
  publicSummary?: RichText;
  /** Only verified certifications with scope and validity. */
  certifications: readonly {
    name: string;
    scope: string;
    issuedAt: IsoDate;
    expiresAt?: IsoDate;
  }[];
  subprocessors: readonly { name: string; purpose: string; location?: string }[];
  contactEmail?: string;
}

export interface JobView extends DocBase {
  employmentType?: string;
  location?: string;
  datePosted: IsoDate;
  validThrough?: IsoDate;
  status: "open" | "closed";
  applicationUrl?: string;
  description?: RichText;
}

export interface LegalPageView {
  id: string;
  slug: LegalSlug;
  title: string;
  version: string;
  effectiveDate: IsoDate;
  body: RichText;
  seo: SeoView;
}

/* ---------- Singletons / pages ---------- */

export interface RoutePageView {
  key: RoutePageKey;
  heading: string;
  intro?: string;
  body?: RichText;
  seo: SeoView;
  cta?: CtaView;
}

export interface ContactRouteView {
  intent: ContactIntent;
  label: string;
  description?: string;
}

export interface ContactPageView extends RoutePageView {
  key: "contact";
  /** CMS "what happens next". When absent the UI shows a neutral receipt and promises no response time. */
  expectations?: RichText;
  successMessage?: string;
  routes: readonly ContactRouteView[];
}

export interface TrustOverviewView extends RoutePageView {
  key: "trust";
  topics: readonly TrustTopicSummary[];
}

export interface ProofItemView {
  label: string;
  /** Verified markers only: no invented logo walls (Stage 8 §8). */
  evidence: EvidenceView;
  href?: string;
}

export interface HomePageView {
  seo: SeoView;
  /**
   * Visitor-facing section headings, authored in the repo content files. A section renders no heading when its
   * entry is absent; the structural labels in locked-copy.ts are never rendered.
   */
  headings: Partial<Record<HomeSectionKey, string>>;
  proof: readonly ProofItemView[];
  solutions: readonly SolutionSummary[];
  practices: readonly PracticeSummary[];
  selectedWork: readonly CaseStudySummary[];
  industries: readonly IndustrySummary[];
  labs: readonly LabAssetSummary[];
  insights: readonly InsightSummary[];
  finalCta?: CtaView;
}

/** Pages whose view is richer than `RoutePageView`. */
export interface RoutePageViewMap {
  contact: ContactPageView;
  trust: TrustOverviewView;
}
export type RoutePageViewFor<K extends RoutePageKey> = K extends keyof RoutePageViewMap
  ? RoutePageViewMap[K]
  : RoutePageView;

/* ---------- Kind maps ---------- */

export interface DocViewMap {
  practice: PracticeView;
  solution: SolutionView;
  offer: OfferView;
  industry: IndustryView;
  caseStudy: CaseStudyView;
  insight: InsightView;
  person: PersonView;
  labAsset: LabAssetView;
  trustItem: TrustTopicView;
  job: JobView;
  legalPage: LegalPageView;
}

export interface DocSummaryMap {
  practice: PracticeSummary;
  solution: SolutionSummary;
  offer: OfferSummary;
  industry: IndustrySummary;
  caseStudy: CaseStudySummary;
  insight: InsightSummary;
  person: PersonSummary;
  labAsset: LabAssetSummary;
  trustItem: TrustTopicSummary;
  job: JobSummary;
  legalPage: LegalPageSummary;
}

export type ViewFor<T extends DocKind> = DocViewMap[T];
export type SummaryFor<T extends DocKind> = DocSummaryMap[T];

export interface SitemapEntry {
  /** Path as produced by routes.ts, starting with "/". */
  path: string;
  kind: DocKind | "route";
  lastModified?: IsoDate;
}
