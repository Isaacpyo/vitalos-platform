/**
 * The "sparse" fixture set: below every publication gate (Work 1 verified case study, Insights 2,
 * Labs 0, Industries 0, Careers 0 open roles) and with optional fields left out. It exercises the
 * closed-gate paths: no navigation, index 404s, noindex details, empty sections.
 */
import { summaryOf } from "../content/fixture-source";
import type { FixtureSet } from "../content/fixture-source";
import type {
  CaseStudyView,
  ContactPageView,
  InsightView,
  JobView,
  LegalPageView,
  OfferView,
  PersonView,
  PracticeView,
  SolutionView,
  TrustTopicView,
} from "../content/types";
import { FIXTURE_LABEL, richText, seo, verifiedEvidence } from "./build";

const L = FIXTURE_LABEL;

const person: PersonView = {
  id: "fixture-person-1",
  slug: "example-person",
  title: `Example Person ${L}`,
  name: `Example Person ${L}`,
  seo: seo("Example Person"),
  isLeadership: true,
  credentials: [],
  sameAs: [],
  insights: [],
};

const offer: OfferView = {
  id: "fixture-offer-1",
  slug: "example-offer",
  title: `Example Offer ${L}`,
  seo: seo("Example Offer"),
  audience: `Example audience ${L}`,
  trigger: `Example trigger ${L}`,
  scope: `Example scope ${L}`,
  outputs: [],
  requirements: [],
  durationCategory: "short",
  exclusions: [],
  nextStep: `Example next step ${L}`,
  solutions: [],
  practices: [],
};

const solution: SolutionView = {
  id: "fixture-solution-1",
  slug: "example-solution",
  title: `Example Solution ${L}`,
  seo: seo("Example Solution"),
  problemStatement: `Example problem statement ${L}`,
  signals: [],
  phases: [],
  offers: [summaryOf("offer", offer)],
  practices: [],
  industries: [],
  work: [],
  faq: [],
};

const practice: PracticeView = {
  id: "fixture-practice-1",
  slug: "example-practice",
  title: `Example Practice ${L}`,
  seo: seo("Example Practice"),
  proposition: `Example proposition ${L}`,
  problems: [],
  capabilities: [],
  solutions: [summaryOf("solution", solution)],
  offers: [],
  industries: [],
  work: [],
};

const caseStudy: CaseStudyView = {
  id: "fixture-case-study-1",
  slug: "example-case-study",
  title: `Example Case Study ${L}`,
  seo: seo("Example Case Study"),
  engagementBasis: "contracted-by-vitalos",
  clientDisplay: "anonymised",
  metrics: [],
  evidence: verifiedEvidence,
  practices: [],
  solutions: [],
  industries: [],
};

const insights: InsightView[] = [1, 2].map((n) => ({
  id: `fixture-insight-${n}`,
  slug: `example-insight-${n}`,
  title: `Example Insight ${n} ${L}`,
  seo: seo(`Example Insight ${n}`),
  format: "insight-article",
  topics: [],
  authors: [summaryOf("person", person)],
  publishedAt: `2026-0${n}-10`,
  body: richText(`insight-${n}`, `Artificial article body ${L}.`),
  related: [],
}));

const trust: TrustTopicView = {
  id: "fixture-trust-security",
  topic: "security",
  title: `Example trust topic: security ${L}`,
  seo: seo("Example trust: security"),
  certifications: [],
  subprocessors: [],
};

/** A closed role: it keeps its page but is not an open role, so the Careers gate stays closed. */
const closedJob: JobView = {
  id: "fixture-job-1",
  slug: "example-closed-role",
  title: `Example Closed Role ${L}`,
  seo: seo("Example Closed Role"),
  datePosted: "2025-11-01",
  validThrough: "2026-01-01",
  status: "closed",
};

const privacy: LegalPageView = {
  id: "fixture-legal-privacy",
  slug: "privacy",
  title: `Example privacy page ${L}`,
  version: "0.0-fixture",
  effectiveDate: "2026-01-01",
  body: richText("legal-privacy", `Artificial placeholder legal text ${L}.`),
  seo: seo("Example privacy"),
};

/** No "what happens next" copy: the UI must show a neutral receipt and promise nothing. */
const contact: ContactPageView = {
  key: "contact",
  heading: `Example contact heading ${L}`,
  seo: seo("Example contact"),
  routes: [],
};

export const sparseFixtureSet: FixtureSet = {
  name: "sparse",
  settings: {},
  home: {
    seo: {},
    headings: {},
    proof: [],
    solutions: [summaryOf("solution", solution)],
    practices: [summaryOf("practice", practice)],
    selectedWork: [],
    industries: [],
    labs: [],
    insights: [],
    leadership: [],
    trustHighlights: [],
  },
  routePages: { contact },
  documents: {
    practice: [practice],
    solution: [solution],
    offer: [offer],
    industry: [],
    caseStudy: [caseStudy],
    insight: insights,
    person: [person],
    labAsset: [],
    trustItem: [trust],
    job: [closedJob],
    legalPage: [privacy],
  },
};
