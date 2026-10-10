/**
 * Test support: a fake `SanityFetcher` that answers every public query with fixture-shaped raw
 * documents (what the projections return), derived from a fixture set. It does not evaluate GROQ;
 * it returns the raw shape for each known query, so the Sanity source and the mappers can be
 * checked against the fixture source for the same content (a round trip).
 */
import { detailQueries, summariesQueries } from "../../queries/registry";
import {
  gateCountsQuery,
  homePageQuery,
  routePageQuery,
  siteSettingsQuery,
  sitemapQuery,
} from "../../queries/registry";
import { hrefForRoutePage, routePageKeys } from "../../routes";
import type { DocKind } from "../types";
import type {
  CaseStudySummary,
  CtaView,
  EvidenceView,
  InsightSummary,
  JobView,
  LabAssetSummary,
  PersonSummary,
  SeoView,
  SummaryFor,
  TrustTopicSummary,
  ViewFor,
} from "../types";
import type { FixtureSet } from "../fixture-source";
import { summaryOf } from "../fixture-source";
import type { SanityFetcher } from "../sanity-source";

const APPROVED = "approved";

const rawEvidence = (evidence: EvidenceView) => ({
  evidenceStatus: evidence.status,
  classification: "public",
  verifiedAt: evidence.verifiedAt,
});

const rawSeo = (seo: SeoView) => ({ ...seo });

function rawCta(cta: CtaView | undefined) {
  if (!cta) return null;
  const routeKey = routePageKeys.find((key) => hrefForRoutePage(key) === cta.href);
  return { label: cta.label, intent: cta.intent ?? null, routeKey: routeKey ?? null, target: null };
}

const identity = (v: { id: string; slug: string; title: string; summary?: string }) => ({
  id: v.id,
  editorialStatus: APPROVED,
  slug: v.slug,
  title: v.title,
  summary: v.summary ?? null,
});

export function createFixtureSanityFetcher(set: FixtureSet): SanityFetcher {
  const docs = <K extends DocKind>(kind: K) => set.documents[kind] as readonly ViewFor<K>[];
  const studyById = (id: string) => docs("caseStudy").find((study) => study.id === id);

  const rawPersonSummary = (p: PersonSummary) => ({
    ...identity(p),
    role: p.role ?? null,
    portrait: null,
  });
  const rawInsightSummary = (i: InsightSummary) => ({
    ...identity(i),
    format: i.format,
    publishedAt: i.publishedAt,
    authors: i.authors.map(rawPersonSummary),
  });
  const rawCaseStudySummary = (s: CaseStudySummary) => {
    const study = studyById(s.id);
    const named = study?.clientDisplay === "named";
    return {
      ...identity(s),
      engagementBasis: s.engagementBasis,
      clientDisplay: named ? "named" : "anonymised",
      anonymisedDescriptor: named ? null : (s.clientLabel ?? null),
      namedPermitted: named,
      clientName: named ? (study?.clientName ?? null) : null,
      evidence: rawEvidence(study?.evidence ?? { status: "pending" }),
    };
  };
  const rawLabSummary = (s: LabAssetSummary) => ({
    ...identity(s),
    labType: s.labType,
    maturity: s.maturity,
    supportVerified: true,
    evidence: rawEvidence({ status: "verified" }),
  });
  const rawTrustSummary = (s: TrustTopicSummary) => ({
    id: s.id,
    editorialStatus: APPROVED,
    topic: s.topic,
    title: s.title,
    summary: s.summary ?? null,
    evidence: rawEvidence({ status: "verified" }),
  });
  const rawOfferSummary = (s: SummaryFor<"offer">) => ({
    ...identity(s),
    durationCategory: s.durationCategory ?? null,
  });
  const basics = (list: readonly SummaryFor<"practice">[]) => list.map(identity);

  const rawJobSummary = (job: JobView) => ({
    ...identity(job),
    location: job.location ?? null,
    employmentType: job.employmentType ?? null,
    status: job.status,
    validThrough: job.validThrough ?? null,
    datePosted: job.datePosted,
  });

  /** Raw detail document for a view, by kind. */
  const rawDetail = (kind: DocKind, view: ViewFor<DocKind>): unknown => {
    switch (kind) {
      case "practice": {
        const v = view as ViewFor<"practice">;
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          proposition: v.proposition,
          problems: v.problems,
          capabilities: v.capabilities,
          body: v.body ?? null,
          solutions: basics(v.solutions),
          offers: v.offers.map(rawOfferSummary),
          industries: basics(v.industries),
          work: v.work.map(rawCaseStudySummary),
          cta: rawCta(v.cta),
        };
      }
      case "solution": {
        const v = view as ViewFor<"solution">;
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          problemStatement: v.problemStatement,
          signals: v.signals,
          impact: v.impact ?? null,
          approach: v.approach ?? null,
          phases: v.phases,
          offers: v.offers.map(rawOfferSummary),
          practices: basics(v.practices),
          industries: basics(v.industries),
          work: v.work.map(rawCaseStudySummary),
          faq: v.faq,
          cta: rawCta(v.cta),
        };
      }
      case "offer": {
        const v = view as ViewFor<"offer">;
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          audience: v.audience,
          trigger: v.trigger,
          scope: v.scope,
          outputs: v.outputs,
          requirements: v.requirements,
          durationCategory: v.durationCategory,
          exclusions: v.exclusions,
          nextStep: v.nextStep,
          solutions: basics(v.solutions),
          practices: basics(v.practices),
          cta: rawCta(v.cta),
        };
      }
      case "industry": {
        const v = view as ViewFor<"industry">;
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          realities: v.realities,
          problems: v.problems,
          aiOpportunities: v.aiOpportunities,
          considerations: v.considerations,
          solutions: basics(v.solutions),
          offers: v.offers.map(rawOfferSummary),
          work: v.work.map(rawCaseStudySummary),
          insights: v.insights.map(rawInsightSummary),
          cta: rawCta(v.cta),
        };
      }
      case "caseStudy": {
        const v = view as ViewFor<"caseStudy">;
        const named = v.clientDisplay === "named";
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          engagementBasis: v.engagementBasis,
          clientDisplay: v.clientDisplay,
          namedPermitted: named,
          clientName: named ? (v.clientName ?? null) : null,
          sector: v.sector ?? null,
          challenge: v.challenge ?? null,
          approach: v.approach ?? null,
          outcome: v.outcome ?? null,
          metrics: v.metrics.map((metric) => ({
            ...metric,
            evidence: rawEvidence(metric.evidence ?? { status: "pending" }),
          })),
          testimonial: v.testimonial ? { ...v.testimonial, permissionStatus: "granted" } : null,
          evidence: rawEvidence(v.evidence),
          practices: basics(v.practices),
          solutions: basics(v.solutions),
          industries: basics(v.industries),
        };
      }
      case "insight": {
        const v = view as ViewFor<"insight">;
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          format: v.format,
          topics: v.topics,
          authors: v.authors.map(rawPersonSummary),
          publishedAt: v.publishedAt,
          body: v.body,
          related: v.related.map(rawInsightSummary),
        };
      }
      case "person": {
        const v = view as ViewFor<"person">;
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          name: v.name,
          role: v.role ?? null,
          isLeadership: v.isLeadership,
          bio: v.bio ?? null,
          portrait: null,
          credentials: v.credentials.map((c) => ({
            label: c.label,
            evidence: rawEvidence(c.evidence),
          })),
          sameAs: v.sameAs.map((url) => ({ label: "Profile", url, verified: true })),
          insights: v.insights.map(rawInsightSummary),
        };
      }
      case "labAsset": {
        const v = view as ViewFor<"labAsset">;
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          labType: v.labType,
          maturity: v.maturity,
          is: v.is ?? null,
          isNot: v.isNot ?? null,
          limitations: v.limitations,
          body: v.body ?? null,
          maintained: Boolean(v.repoUrl ?? v.demoUrl),
          repoUrl: v.repoUrl ?? null,
          demoUrl: v.demoUrl ?? null,
          supportVerified: true,
          evidence: rawEvidence({ status: "verified" }),
        };
      }
      case "trustItem": {
        const v = view as ViewFor<"trustItem">;
        return {
          id: v.id,
          editorialStatus: APPROVED,
          topic: v.topic,
          title: v.title,
          summary: v.summary ?? null,
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          evidence: rawEvidence({ status: "verified" }),
          publicSummary: v.publicSummary ?? null,
          certifications: v.certifications.map((c) => ({
            ...c,
            evidence: rawEvidence({ status: "verified", verifiedAt: "2026-01-15" }),
          })),
          subprocessors: v.subprocessors,
          contactEmail: v.contactEmail ?? null,
        };
      }
      case "job": {
        const v = view as ViewFor<"job">;
        return {
          ...identity(v),
          updatedAt: v.updatedAt,
          seo: rawSeo(v.seo),
          employmentType: v.employmentType ?? null,
          location: v.location ?? null,
          datePosted: v.datePosted,
          validThrough: v.validThrough ?? null,
          status: v.status,
          applicationUrl: v.applicationUrl ?? null,
          description: v.description ?? null,
        };
      }
      case "legalPage": {
        const v = view as ViewFor<"legalPage">;
        return {
          id: v.id,
          editorialStatus: APPROVED,
          slug: v.slug,
          title: v.title,
          version: v.version,
          effectiveDate: v.effectiveDate,
          body: v.body,
          seo: rawSeo(v.seo),
        };
      }
    }
  };

  const rawSummary = (kind: DocKind, view: ViewFor<DocKind>): unknown => {
    switch (kind) {
      case "offer":
        return rawOfferSummary(summaryOf("offer", view as ViewFor<"offer">));
      case "caseStudy":
        return rawCaseStudySummary(summaryOf("caseStudy", view as ViewFor<"caseStudy">));
      case "insight":
        return rawInsightSummary(summaryOf("insight", view as ViewFor<"insight">));
      case "person":
        return rawPersonSummary(summaryOf("person", view as ViewFor<"person">));
      case "labAsset":
        return rawLabSummary(summaryOf("labAsset", view as ViewFor<"labAsset">));
      case "trustItem":
        return rawTrustSummary(summaryOf("trustItem", view as ViewFor<"trustItem">));
      case "job":
        return rawJobSummary(view as ViewFor<"job">);
      case "legalPage": {
        const legal = view as ViewFor<"legalPage">;
        return { id: legal.id, editorialStatus: APPROVED, slug: legal.slug, title: legal.title };
      }
      default:
        return identity(view as ViewFor<"practice">);
    }
  };

  const kinds = Object.keys(set.documents) as DocKind[];
  const detailByQuery = new Map(kinds.map((kind) => [detailQueries[kind], kind]));
  const summariesByQuery = new Map(kinds.map((kind) => [summariesQueries[kind], kind]));

  const matches = (kind: DocKind, view: ViewFor<DocKind>, params: Record<string, unknown>) => {
    if (kind === "trustItem") return (view as ViewFor<"trustItem">).topic === params.topic;
    if (kind === "labAsset") {
      const lab = view as ViewFor<"labAsset">;
      return lab.slug === params.slug && lab.labType === params.labType;
    }
    return (view as ViewFor<"practice">).slug === params.slug;
  };

  const rawHome = () => {
    const home = set.home;
    if (!home) return null;
    return {
      editorialStatus: APPROVED,
      seo: rawSeo(home.seo),
      homeSections: Object.entries(home.headings).map(([sectionKey, visibleHeading]) => ({
        sectionKey,
        visibleHeading,
      })),
      proof: home.proof.map((item) => ({
        label: item.label,
        href: item.href ?? null,
        evidence: rawEvidence(item.evidence),
      })),
      solutions: basics(home.solutions),
      practices: basics(home.practices),
      selectedWork: home.selectedWork.map(rawCaseStudySummary),
      industries: basics(home.industries),
      labs: home.labs.map(rawLabSummary),
      insights: home.insights.map(rawInsightSummary),
      leadership: home.leadership.map(rawPersonSummary),
      trustHighlights: home.trustHighlights.map(rawTrustSummary),
      finalCta: rawCta(home.finalCta),
    };
  };

  const rawSettings = () => {
    const s = set.settings;
    return {
      ...s,
      editorialStatus: APPROVED,
      social: s.social?.map((link) => ({ ...link, verified: true })) ?? null,
      defaultSeo: s.defaultSeo ? rawSeo(s.defaultSeo) : null,
      logo: null,
    };
  };

  const rawRoutePage = (key: string) => {
    const page = (set.routePages as Record<string, Record<string, unknown> | undefined>)[key];
    if (!page) return null;
    return {
      editorialStatus: APPROVED,
      key,
      heading: page.heading,
      intro: page.intro ?? null,
      body: page.body ?? null,
      seo: rawSeo(page.seo as SeoView),
      cta: rawCta(page.cta as CtaView | undefined),
      expectations: page.expectations ?? null,
      successMessage: page.successMessage ?? null,
      routes: page.routes ?? null,
    };
  };

  return (query, params) => {
    const detailKind = detailByQuery.get(query);
    if (detailKind) {
      const view = docs(detailKind).find((candidate) => matches(detailKind, candidate, params));
      return Promise.resolve(view ? rawDetail(detailKind, view) : null);
    }
    const summaryKind = summariesByQuery.get(query);
    if (summaryKind) {
      return Promise.resolve(docs(summaryKind).map((view) => rawSummary(summaryKind, view)));
    }
    switch (query) {
      case siteSettingsQuery:
        return Promise.resolve(rawSettings());
      case homePageQuery:
        return Promise.resolve(rawHome());
      case routePageQuery:
        return Promise.resolve(rawRoutePage(String(params.key)));
      case gateCountsQuery: {
        const today = String(params.today);
        return Promise.resolve({
          work: docs("caseStudy").filter((s) => s.evidence.status === "verified").length,
          insights: docs("insight").filter((i) => i.authors.length > 0).length,
          labs: docs("labAsset").length,
          industries: docs("industry").length,
          careers: docs("job").filter(
            (j) => j.status === "open" && (j.validThrough === undefined || j.validThrough >= today),
          ).length,
        });
      }
      case sitemapQuery:
        return Promise.resolve(
          Object.fromEntries(
            kinds.map((kind) => [
              kind,
              docs(kind)
                // Mirrors the GROQ: only case studies with verified evidence are public.
                .filter(
                  (view) =>
                    kind !== "caseStudy" ||
                    (view as ViewFor<"caseStudy">).evidence.status === "verified",
                )
                .map((view) => {
                  const doc = view as unknown as Record<string, unknown>;
                  const seo = doc.seo as SeoView;
                  return {
                    slug: doc.slug ?? null,
                    topic: doc.topic ?? null,
                    labType: doc.labType ?? null,
                    // Jobs only in the GROQ; the mapper ignores them for other kinds.
                    status: kind === "job" ? (doc.status ?? null) : null,
                    validThrough: kind === "job" ? (doc.validThrough ?? null) : null,
                    updatedAt: doc.updatedAt ?? null,
                    noindex: seo.noindex ?? null,
                    editorialStatus: APPROVED,
                    classification: "public",
                  };
                }),
            ]),
          ),
        );
      default:
        return Promise.reject(new Error(`Unexpected query: ${query.slice(0, 80)}`));
    }
  };
}
