/**
 * The "full" fixture set: above every publication gate (Work 3 verified case studies, Insights 7
 * with a named author, Labs 2, Industries 2, Careers 1 open role) and with every field populated.
 * Artificial content only; see build.ts.
 */
import { summaryOf } from "../content/fixture-source";
import type { FixtureSet } from "../content/fixture-source";
import { homeSections } from "../locked-copy";
import { contactIntents, routePageKeys, trustTopics } from "../routes";
import type { RoutePageKey } from "../routes";
import type {
  CaseStudyView,
  ContactPageView,
  HomePageView,
  IndustryView,
  InsightView,
  JobView,
  LabAssetView,
  LegalPageView,
  OfferView,
  PersonView,
  PracticeView,
  RoutePageView,
  SolutionView,
  TrustOverviewView,
  TrustTopicView,
} from "../content/types";
import {
  FIXTURE_FAR_FUTURE,
  FIXTURE_LABEL,
  exampleEmail,
  exampleUrl,
  fixtureHeading,
  fixtureMetric,
  humaniseKey,
  pendingEvidence,
  richText,
  seo,
  verifiedEvidence,
} from "./build";

const L = FIXTURE_LABEL;

/* ---------- People ---------- */

const examplePerson: PersonView = {
  id: "fixture-person-1",
  slug: "example-person",
  title: `Example Person ${L}`,
  name: `Example Person ${L}`,
  summary: `An artificial leadership profile ${L}.`,
  seo: seo("Example Person"),
  updatedAt: "2026-06-01T09:00:00Z",
  role: `Example role ${L}`,
  isLeadership: true,
  bio: richText("person-1-bio", `Artificial biography paragraph ${L}. Not a real person.`),
  credentials: [{ label: `Example credential ${L}`, evidence: verifiedEvidence }],
  sameAs: [exampleUrl("profile/example-person")],
  insights: [],
};

const examplePersonTwo: PersonView = {
  id: "fixture-person-2",
  slug: "example-person-two",
  title: `Example Person Two ${L}`,
  name: `Example Person Two ${L}`,
  summary: `Another artificial profile ${L}.`,
  seo: seo("Example Person Two"),
  updatedAt: "2026-06-02T09:00:00Z",
  role: `Example engineer ${L}`,
  isLeadership: false,
  credentials: [],
  sameAs: [],
  insights: [],
};

/* ---------- Case studies ---------- */

const caseStudyOne: CaseStudyView = {
  id: "fixture-case-study-1",
  slug: "example-case-study",
  title: `Example Case Study ${L}`,
  summary: `An artificial case study with a named example client ${L}.`,
  seo: seo("Example Case Study"),
  updatedAt: "2026-05-01T09:00:00Z",
  engagementBasis: "contracted-by-vitalos",
  clientDisplay: "named",
  clientName: `Example Client ${L}`,
  sector: `Example sector ${L}`,
  challenge: richText("cs-1-challenge", `Artificial challenge ${L}.`),
  approach: richText("cs-1-approach", `Artificial approach ${L}.`),
  outcome: richText("cs-1-outcome", `Artificial outcome ${L}.`),
  metrics: [fixtureMetric("A")],
  testimonial: {
    quote: `An artificial quote ${L}. Not a real testimonial.`,
    attribution: `Example Person ${L}`,
    role: `Example role ${L}`,
  },
  evidence: verifiedEvidence,
  practices: [],
  solutions: [],
  industries: [],
};

const caseStudyTwo: CaseStudyView = {
  id: "fixture-case-study-2",
  slug: "example-case-study-two",
  title: `Example Case Study Two ${L}`,
  summary: `An artificial anonymised case study ${L}.`,
  seo: seo("Example Case Study Two"),
  updatedAt: "2026-05-02T09:00:00Z",
  engagementBasis: "prior-team-experience",
  clientDisplay: "anonymised",
  sector: `Example sector two ${L}`,
  outcome: richText("cs-2-outcome", `Artificial outcome ${L}.`),
  metrics: [fixtureMetric("B")],
  evidence: verifiedEvidence,
  practices: [],
  solutions: [],
  industries: [],
};

/** Evidence still pending: listed, but it does not count toward the Work gate. */
const caseStudyPending: CaseStudyView = {
  id: "fixture-case-study-3",
  slug: "example-case-study-pending",
  title: `Example Case Study Three ${L}`,
  summary: `An artificial case study whose evidence is pending ${L}.`,
  seo: seo("Example Case Study Three"),
  updatedAt: "2026-05-03T09:00:00Z",
  engagementBasis: "contracted-by-vitalos",
  clientDisplay: "anonymised",
  sector: `Example sector three ${L}`,
  metrics: [],
  evidence: pendingEvidence,
  practices: [],
  solutions: [],
  industries: [],
};

/* ---------- Insights ---------- */

const insightFormats = [
  "insight-article",
  "executive-briefing",
  "engineering-note",
  "research-report",
  "guide-playbook",
  "case-study-insight",
  "webinar-event-recap",
] as const;

const insights: InsightView[] = insightFormats.map((format, index) => {
  const n = index + 1;
  return {
    id: `fixture-insight-${n}`,
    slug: `example-insight-${n}`,
    title: `Example Insight ${n} ${L}`,
    summary: `An artificial ${format} ${L}.`,
    seo: seo(`Example Insight ${n}`),
    updatedAt: `2026-0${n}-15T09:00:00Z`,
    format,
    topics: ["ai-agents"],
    authors: [summaryOf("person", examplePerson)],
    publishedAt: `2026-0${n}-10`,
    body: richText(`insight-${n}`, `Artificial article body ${L}. Not real content.`),
    related: [],
  };
});
const insightSummaries = insights.map((insight) => summaryOf("insight", insight));
const linkedInsights: InsightView[] = insights.map((insight, index) => ({
  ...insight,
  related: insightSummaries.filter((_, other) => other !== index).slice(0, 2),
}));

/* ---------- Commercial ---------- */

const industryOne: IndustryView = {
  id: "fixture-industry-1",
  slug: "example-industry",
  title: `Example Industry ${L}`,
  summary: `An artificial industry ${L}.`,
  seo: seo("Example Industry"),
  updatedAt: "2026-04-01T09:00:00Z",
  realities: [`Example reality ${L}`],
  problems: [`Example problem ${L}`],
  aiOpportunities: [`Example AI opportunity ${L}`],
  considerations: [`Example consideration ${L}`],
  solutions: [],
  offers: [],
  work: [summaryOf("caseStudy", caseStudyOne)],
  insights: insightSummaries.slice(0, 2),
};

const industryTwo: IndustryView = {
  id: "fixture-industry-2",
  slug: "example-industry-two",
  title: `Example Industry Two ${L}`,
  summary: `Another artificial industry ${L}.`,
  seo: seo("Example Industry Two"),
  updatedAt: "2026-04-02T09:00:00Z",
  realities: [`Example reality two ${L}`],
  problems: [`Example problem two ${L}`],
  aiOpportunities: [],
  considerations: [],
  solutions: [],
  offers: [],
  work: [],
  insights: [],
};

const offerOne: OfferView = {
  id: "fixture-offer-1",
  slug: "example-offer",
  title: `Example Offer ${L}`,
  summary: `An artificial offer ${L}.`,
  seo: seo("Example Offer"),
  updatedAt: "2026-04-03T09:00:00Z",
  audience: `Example audience ${L}`,
  trigger: `Example trigger ${L}`,
  scope: `Example scope ${L}`,
  outputs: [`Example output ${L}`],
  requirements: [`Example requirement ${L}`],
  durationCategory: "short",
  exclusions: [`Example exclusion ${L}`],
  nextStep: `Example next step ${L}`,
  solutions: [],
  practices: [],
};

const offerTwo: OfferView = {
  ...offerOne,
  id: "fixture-offer-2",
  slug: "example-offer-two",
  title: `Example Offer Two ${L}`,
  summary: `Another artificial offer ${L}.`,
  seo: seo("Example Offer Two"),
  durationCategory: "medium",
};

const solutionOne: SolutionView = {
  id: "fixture-solution-1",
  slug: "example-solution",
  title: `Example Solution ${L}`,
  summary: `An artificial solution ${L}.`,
  seo: seo("Example Solution"),
  updatedAt: "2026-04-04T09:00:00Z",
  problemStatement: `Example problem statement ${L}`,
  signals: [`Example signal ${L}`],
  impact: `Example impact ${L}`,
  approach: richText("solution-1-approach", `Artificial approach ${L}.`),
  phases: [{ title: `Example phase ${L}`, description: `Example phase description ${L}` }],
  offers: [summaryOf("offer", offerOne)],
  practices: [],
  industries: [summaryOf("industry", industryOne)],
  work: [summaryOf("caseStudy", caseStudyOne)],
  faq: [{ question: `Example question ${L}?`, answer: `Example answer ${L}.` }],
};

const solutionTwo: SolutionView = {
  ...solutionOne,
  id: "fixture-solution-2",
  slug: "example-solution-two",
  title: `Example Solution Two ${L}`,
  summary: `Another artificial solution ${L}.`,
  seo: seo("Example Solution Two"),
  offers: [summaryOf("offer", offerTwo)],
  industries: [],
  work: [],
};

const practiceOne: PracticeView = {
  id: "fixture-practice-1",
  slug: "example-practice",
  title: `Example Practice ${L}`,
  summary: `An artificial practice ${L}.`,
  seo: seo("Example Practice"),
  updatedAt: "2026-04-05T09:00:00Z",
  proposition: `Example proposition ${L}`,
  problems: [`Example problem ${L}`],
  capabilities: [`Example capability ${L}`],
  body: richText("practice-1-body", `Artificial practice body ${L}.`),
  solutions: [summaryOf("solution", solutionOne), summaryOf("solution", solutionTwo)],
  offers: [summaryOf("offer", offerOne)],
  industries: [summaryOf("industry", industryOne)],
  work: [summaryOf("caseStudy", caseStudyOne), summaryOf("caseStudy", caseStudyTwo)],
  cta: { label: `Talk about example work ${L}`, href: "/contact", intent: "project" },
};

const practiceTwo: PracticeView = {
  ...practiceOne,
  id: "fixture-practice-2",
  slug: "example-practice-two",
  title: `Example Practice Two ${L}`,
  summary: `Another artificial practice ${L}.`,
  seo: seo("Example Practice Two"),
  solutions: [],
  offers: [summaryOf("offer", offerTwo)],
  industries: [],
  work: [],
};

/* ---------- Labs, trust, careers, legal ---------- */

const labOne: LabAssetView = {
  id: "fixture-lab-1",
  slug: "example-reference-architecture",
  title: `Example Reference Architecture ${L}`,
  summary: `An artificial lab asset ${L}.`,
  seo: seo("Example Reference Architecture"),
  updatedAt: "2026-03-01T09:00:00Z",
  labType: "reference-architectures",
  maturity: "concept",
  is: `An artificial concept ${L}`,
  isNot: `Not a real product ${L}`,
  limitations: `Fixture only; no real implementation ${L}`,
};

const labTwo: LabAssetView = {
  id: "fixture-lab-2",
  slug: "example-open-source-tool",
  title: `Example Open Source Tool ${L}`,
  summary: `An artificial maintained lab asset ${L}.`,
  seo: seo("Example Open Source Tool"),
  updatedAt: "2026-03-02T09:00:00Z",
  labType: "open-source",
  maturity: "prototype",
  limitations: `Fixture only; the links do not resolve ${L}`,
  repoUrl: exampleUrl("repo/example-open-source-tool"),
  demoUrl: exampleUrl("demo/example-open-source-tool"),
};

const trustItems: TrustTopicView[] = trustTopics.map((topic) => ({
  id: `fixture-trust-${topic}`,
  topic,
  title: `Example trust topic: ${topic} ${L}`,
  summary: `An artificial statement about ${topic} ${L}. Not a real claim.`,
  seo: seo(`Example trust: ${topic}`),
  updatedAt: "2026-02-01T09:00:00Z",
  publicSummary: richText(`trust-${topic}`, `Artificial public summary ${L}.`),
  certifications:
    topic === "certifications"
      ? [
          {
            name: `Example Certification ${L}`,
            scope: `Example scope ${L}`,
            issuedAt: "2026-01-01",
            expiresAt: FIXTURE_FAR_FUTURE,
          },
        ]
      : [],
  subprocessors:
    topic === "subprocessors"
      ? [
          {
            name: `Example Subprocessor ${L}`,
            purpose: `Example purpose ${L}`,
            location: `Example location ${L}`,
          },
        ]
      : [],
  contactEmail: exampleEmail("trust"),
}));

const jobOpen: JobView = {
  id: "fixture-job-1",
  slug: "example-role",
  title: `Example Role ${L}`,
  summary: `An artificial open role ${L}.`,
  seo: seo("Example Role"),
  updatedAt: "2026-02-10T09:00:00Z",
  employmentType: "full-time",
  location: `Example location ${L}`,
  datePosted: "2026-02-01",
  validThrough: FIXTURE_FAR_FUTURE,
  status: "open",
  applicationUrl: exampleUrl("apply/example-role"),
  description: richText("job-1", `Artificial role description ${L}.`),
};

const jobClosed: JobView = {
  id: "fixture-job-2",
  slug: "example-closed-role",
  title: `Example Closed Role ${L}`,
  summary: `An artificial closed role ${L}.`,
  seo: seo("Example Closed Role"),
  updatedAt: "2026-02-11T09:00:00Z",
  employmentType: "contract",
  location: `Example location ${L}`,
  datePosted: "2025-11-01",
  validThrough: "2026-01-01",
  status: "closed",
};

const legalPages: LegalPageView[] = (
  ["privacy", "cookies", "terms", "acceptable-use"] as const
).map((slug) => ({
  id: `fixture-legal-${slug}`,
  slug,
  title: `Example ${slug} page ${L}`,
  version: "0.0-fixture",
  effectiveDate: "2026-01-01",
  body: richText(`legal-${slug}`, `Artificial placeholder legal text ${L}. Not legal advice.`),
  seo: seo(`Example ${slug}`),
}));

/* ---------- Relations that point back ---------- */

const people: PersonView[] = [{ ...examplePerson, insights: insightSummaries }, examplePersonTwo];

const caseStudies: CaseStudyView[] = [
  {
    ...caseStudyOne,
    practices: [summaryOf("practice", practiceOne)],
    solutions: [summaryOf("solution", solutionOne)],
    industries: [summaryOf("industry", industryOne)],
  },
  { ...caseStudyTwo, practices: [summaryOf("practice", practiceOne)] },
  caseStudyPending,
];

/* ---------- Route pages and home ---------- */

function routePage(key: RoutePageKey): RoutePageView {
  return {
    key,
    heading: fixtureHeading(key),
    intro: `Artificial introduction for ${humaniseKey(key).toLowerCase()} ${L}.`,
    seo: seo(`Example ${key}`),
  };
}

const contactPage: ContactPageView = {
  ...routePage("contact"),
  key: "contact",
  expectations: richText("contact-expectations", `Artificial expectations text ${L}.`),
  successMessage: `Artificial success message ${L}.`,
  routes: contactIntents.map((intent) => ({
    intent,
    label: `Example ${intent} route ${L}`,
    description: `Artificial description ${L}.`,
  })),
};

const trustOverview: TrustOverviewView = {
  ...routePage("trust"),
  key: "trust",
  topics: trustItems.map((item) => summaryOf("trustItem", item)),
};

const routePages: FixtureSet["routePages"] = Object.fromEntries(
  routePageKeys.map((key) => [key, routePage(key)]),
);
routePages.contact = contactPage;
routePages.trust = trustOverview;

const home: HomePageView = {
  seo: seo("Example home"),
  headings: Object.fromEntries(
    homeSections.map((section) => [section.key, fixtureHeading(section.key)]),
  ),
  proof: [{ label: `Example verified marker ${L}`, evidence: verifiedEvidence }],
  solutions: [summaryOf("solution", solutionOne), summaryOf("solution", solutionTwo)],
  practices: [summaryOf("practice", practiceOne), summaryOf("practice", practiceTwo)],
  selectedWork: [summaryOf("caseStudy", caseStudyOne), summaryOf("caseStudy", caseStudyTwo)],
  industries: [summaryOf("industry", industryOne), summaryOf("industry", industryTwo)],
  labs: [summaryOf("labAsset", labOne), summaryOf("labAsset", labTwo)],
  insights: insightSummaries.slice(0, 3),
  finalCta: { label: `Talk about example work ${L}`, href: "/contact", intent: "general" },
};

export const fullFixtureSet: FixtureSet = {
  name: "full",
  settings: {
    legalName: `Example Practice Ltd ${L}`,
    companyNumber: `00000000 ${L}`,
    registeredAddress: `1 Example Street, Example Town ${L}`,
    contactEmail: exampleEmail("hello"),
    securityEmail: exampleEmail("security"),
    podcast: {
      spotifyUrl: "https://open.spotify.com/show/example-fixture",
      appleUrl: "https://podcasts.apple.com/gb/podcast/example-fixture",
    },
    social: [{ label: `Example profile ${L}`, href: exampleUrl("social/example") }],
    defaultSeo: { title: `Example site ${L}`, description: `Artificial site description ${L}.` },
  },
  home,
  routePages,
  documents: {
    practice: [practiceOne, practiceTwo],
    solution: [solutionOne, solutionTwo],
    offer: [offerOne, offerTwo],
    industry: [industryOne, industryTwo],
    caseStudy: caseStudies,
    insight: linkedInsights,
    person: people,
    labAsset: [labOne, labTwo],
    trustItem: trustItems,
    job: [jobOpen, jobClosed],
    legalPage: legalPages,
  },
};
