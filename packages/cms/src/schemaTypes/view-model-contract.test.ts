/**
 * Guards the contract between the schema (this workstream) and the public view models (W0 content
 * types, mapped by C2). Each view property names the schema field it is read from, or is marked as
 * derived (computed from other documents by GROQ). The mapped types are exhaustive: when a view
 * model gains a property, this file stops compiling until the schema side is decided.
 */
import { describe, expect, it } from "vitest";
import type {
  CaseStudyView,
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
  ContactPageView,
  SiteSettingsView,
  SolutionView,
  TrustTopicView,
} from "../content/types";
import { documentTypes } from "./index";

/** A schema field name, or "derived": computed from other documents or system fields. */
type Source = string;

/** `placeholder` is set only by the draft content source (ADR-025); no schema field backs it. */
type Base = "id" | "slug" | "title" | "summary" | "seo" | "updatedAt" | "placeholder";
type Mapping<View, Omitted extends PropertyKey = Base> = {
  [K in Exclude<keyof View, Omitted>]-?: Source;
};

const practice: Mapping<PracticeView> = {
  proposition: "proposition",
  problems: "problems",
  capabilities: "capabilities",
  body: "body",
  solutions: "solutions",
  offers: "derived", // reverse of offer.practices
  industries: "industries",
  work: "work",
  cta: "cta",
};
const solution: Mapping<SolutionView> = {
  problemStatement: "problemStatement",
  signals: "signals",
  impact: "impact",
  approach: "approach",
  phases: "phases",
  offers: "offers",
  practices: "practices",
  industries: "industries",
  work: "work",
  faq: "faq",
  cta: "cta",
};
const offer: Mapping<OfferView> = {
  audience: "audience",
  trigger: "trigger",
  scope: "scope",
  outputs: "outputs",
  requirements: "requirements",
  durationCategory: "durationCategory",
  exclusions: "exclusions",
  nextStep: "nextStep",
  solutions: "solutions",
  practices: "practices",
  cta: "cta",
};
const industry: Mapping<IndustryView> = {
  realities: "realities",
  problems: "problems",
  aiOpportunities: "aiOpportunities",
  considerations: "considerations",
  solutions: "solutions",
  offers: "offers",
  work: "work",
  insights: "insights",
  cta: "cta",
};
const caseStudy: Mapping<CaseStudyView> = {
  engagementBasis: "engagementBasis",
  clientDisplay: "clientDisplay",
  clientName: "clientName",
  sector: "sector",
  challenge: "challenge",
  approach: "approach",
  outcome: "outcome",
  metrics: "metrics",
  testimonial: "testimonial",
  evidence: "evidence",
  practices: "practices",
  solutions: "solutions",
  industries: "industries",
};
const insight: Mapping<InsightView> = {
  format: "format",
  topics: "topics",
  authors: "authors",
  publishedAt: "publishedAt",
  body: "body",
  related: "related",
};
const person: Mapping<PersonView, Exclude<Base, "title">> = {
  title: "name",
  name: "name",
  role: "role",
  isLeadership: "isLeadership",
  bio: "bio",
  portrait: "portrait",
  credentials: "credentials",
  sameAs: "sameAs",
  insights: "derived", // reverse of insight.authors
};
const labAsset: Mapping<LabAssetView> = {
  labType: "labType",
  maturity: "maturity",
  is: "is",
  isNot: "isNot",
  limitations: "limitations",
  body: "body",
  repoUrl: "repoUrl",
  demoUrl: "demoUrl",
};
const trustItem: Mapping<TrustTopicView, "id" | "title" | "summary" | "seo" | "updatedAt"> = {
  topic: "topic",
  publicSummary: "publicSummary",
  certifications: "certifications",
  subprocessors: "subprocessors",
  contactEmail: "contactEmail",
};
const job: Mapping<JobView> = {
  employmentType: "employmentType",
  location: "location",
  datePosted: "datePosted",
  validThrough: "validThrough",
  status: "status",
  applicationUrl: "applicationUrl",
  description: "description",
};
const legalPage: Mapping<LegalPageView, "id" | "slug" | "title" | "seo"> = {
  version: "version",
  effectiveDate: "effectiveDate",
  body: "body",
};
const routePage: Mapping<ContactPageView, "seo" | "key"> = {
  heading: "heading",
  intro: "intro",
  body: "body",
  cta: "cta",
  expectations: "expectations",
  successMessage: "successMessage",
  routes: "routes",
};
const routePageBase: Mapping<RoutePageView, "seo" | "key"> = {
  heading: "heading",
  intro: "intro",
  body: "body",
  cta: "cta",
};
const homePage: Mapping<HomePageView, "seo"> = {
  headings: "homeSections",
  proof: "proof",
  solutions: "solutions",
  practices: "practices",
  selectedWork: "selectedWork",
  industries: "industries",
  labs: "labs",
  insights: "insights",
  leadership: "leadership",
  trustHighlights: "trustHighlights",
  finalCta: "finalCta",
};
const siteSettings: Mapping<SiteSettingsView, never> = {
  legalName: "legalName",
  companyNumber: "companyNumber",
  registeredAddress: "registeredAddress",
  contactEmail: "contactEmail",
  securityEmail: "securityEmail",
  social: "social",
  defaultSeo: "defaultSeo",
  logo: "logo",
};

const mappings: Record<string, Record<string, Source>> = {
  practice,
  solution,
  offer,
  industry,
  caseStudy,
  insight,
  person,
  labAsset,
  trustItem,
  job,
  legalPage,
  routePage: { ...routePageBase, ...routePage },
  homePage,
  siteSettings,
};

const fieldNames = (type: string): string[] =>
  (documentTypes as unknown as { name: string; fields: { name: string }[] }[])
    .find((doc) => doc.name === type)
    ?.fields.map((field) => field.name) ?? [];

describe("schema feeds the public view models", () => {
  for (const [type, mapping] of Object.entries(mappings)) {
    it(`${type}: every mapped view property has a schema field`, () => {
      const available = fieldNames(type);
      for (const [property, source] of Object.entries(mapping)) {
        if (source === "derived") continue;
        expect(available, `${type}.${property} <- ${source}`).toContain(source);
      }
    });
  }

  it("keeps document SEO and the slug/title basics on every routable document", () => {
    for (const type of [
      "practice",
      "solution",
      "offer",
      "industry",
      "caseStudy",
      "insight",
      "labAsset",
      "job",
    ]) {
      const available = fieldNames(type);
      expect(available, type).toEqual(expect.arrayContaining(["title", "slug", "summary", "seo"]));
    }
    expect(fieldNames("person")).toEqual(expect.arrayContaining(["name", "slug", "seo"]));
    expect(fieldNames("trustItem")).toEqual(expect.arrayContaining(["title", "summary", "seo"]));
  });
});
