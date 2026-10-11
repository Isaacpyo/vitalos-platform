/**
 * Artificial documents for schema tests. Obviously fake: "(fixture)" titles, `*.invalid` addresses,
 * no real client, outcome or person. Each factory returns a document that passes validation; tests
 * override fields to break exactly one rule.
 */

export const FIXTURE_TODAY = "2026-10-10";

export const ref = (id: string) => ({ _type: "reference", _ref: id });

export const governanceOk = () => ({
  _type: "governance",
  owner: "Example Owner (fixture)",
  editorialStatus: "approved",
  reviewDate: "2027-04-01",
});

export const evidenceVerified = () => ({
  _type: "evidence",
  evidenceStatus: "verified",
  classification: "public",
  evidenceOwner: "Example Owner (fixture)",
  evidenceReference: "REG-0001 (fixture)",
  verifiedAt: "2026-09-01",
});

export const evidencePending = () => ({
  _type: "evidence",
  evidenceStatus: "pending",
  classification: "public",
});

const base = (type: string) => ({
  _id: `${type}-fixture`,
  _type: type,
  locale: "en-GB",
  governance: governanceOk(),
});

export const validDocs = {
  practice: () => ({
    ...base("practice"),
    title: "Example Practice (fixture)",
    slug: { _type: "slug", current: "example-practice" },
    proposition: "An example proposition for a fixture practice.",
    problems: ["Example problem (fixture)"],
    capabilities: ["Example capability (fixture)"],
  }),
  solution: () => ({
    ...base("solution"),
    title: "Example Solution (fixture)",
    slug: { _type: "slug", current: "example-solution" },
    problemStatement: "An example problem statement for a fixture solution.",
    signals: ["Example signal (fixture)"],
    offers: [{ ...ref("offer-fixture"), _key: "a" }],
  }),
  offer: () => ({
    ...base("offer"),
    title: "Example Offer (fixture)",
    slug: { _type: "slug", current: "example-offer" },
    audience: "Example audience (fixture)",
    trigger: "Example trigger (fixture)",
    scope: "Example scope (fixture)",
    outputs: ["Example output (fixture)"],
    durationCategory: "short",
    nextStep: "Example next step (fixture)",
    solutions: [{ ...ref("solution-fixture"), _key: "a" }],
  }),
  industry: () => ({
    ...base("industry"),
    title: "Example Industry (fixture)",
    slug: { _type: "slug", current: "example-industry" },
    realities: ["Example reality (fixture)"],
    problems: ["Example problem (fixture)"],
  }),
  caseStudy: () => ({
    ...base("caseStudy"),
    title: "Example Case Study (fixture)",
    slug: { _type: "slug", current: "example-case-study" },
    engagementBasis: "contracted-by-vitalos",
    clientDisplay: "anonymised",
    anonymisedDescriptor: "A fixture organisation",
    evidence: evidenceVerified(),
  }),
  insight: () => ({
    ...base("insight"),
    title: "Example Insight (fixture)",
    slug: { _type: "slug", current: "example-insight" },
    format: "insight-article",
    topics: ["ai-agents"],
    authors: [{ ...ref("person-fixture"), _key: "a" }],
    publishedAt: "2026-09-01",
    body: [
      {
        _type: "block",
        _key: "b1",
        style: "normal",
        children: [{ _type: "span", _key: "s1", text: "Example body (fixture)", marks: [] }],
        markDefs: [],
      },
    ],
  }),
  person: () => ({
    ...base("person"),
    name: "Example Person (fixture)",
    slug: { _type: "slug", current: "example-person" },
  }),
  labAsset: () => ({
    ...base("labAsset"),
    title: "Example Lab Asset (fixture)",
    slug: { _type: "slug", current: "example-lab-asset" },
    labType: "research",
    maturity: "concept",
    limitations: "Example limitations (fixture)",
    maintained: false,
    evidence: evidencePending(),
  }),
  trustItem: () => ({
    ...base("trustItem"),
    title: "Example Security Item (fixture)",
    topic: "security",
    evidence: evidenceVerified(),
  }),
  job: () => ({
    ...base("job"),
    title: "Example Role (fixture)",
    slug: { _type: "slug", current: "example-role" },
    employmentType: "full-time",
    location: "Example location (fixture)",
    datePosted: "2026-09-15",
    status: "closed",
  }),
  legalPage: () => ({
    ...base("legalPage"),
    title: "Example Privacy Notice (fixture)",
    slug: { _type: "slug", current: "privacy" },
    version: "0.0-fixture",
    effectiveDate: "2026-10-01",
    body: [
      {
        _type: "block",
        _key: "b1",
        style: "normal",
        children: [{ _type: "span", _key: "s1", text: "Example legal text (fixture)", marks: [] }],
        markDefs: [],
      },
    ],
  }),
  routePage: () => ({
    ...base("routePage"),
    routeKey: "what-we-do",
    heading: "Example heading (fixture)",
  }),
  homePage: () => ({
    ...base("homePage"),
    homeSections: [
      {
        _type: "homeSectionHeading",
        _key: "problems",
        sectionKey: "problems",
        visibleHeading: "Example heading (fixture)",
      },
    ],
  }),
  siteSettings: () => ({
    ...base("siteSettings"),
    legalName: "Example Ltd (fixture)",
    contactEmail: "contact@example.invalid",
  }),
  redirect: () => ({
    ...base("redirect"),
    source: "/old-example",
    status: 301,
    destination: "/what-we-do",
  }),
} as const;

export type ValidDocType = keyof typeof validDocs;
