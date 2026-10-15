/**
 * Assembles the draft content into a content set: views with resolved relations (both directions
 * of every relation are unioned, as the former CMS queries did), the homepage selection and the
 * provenance register.
 */
import { summaryOf } from "../content/fixture-source";
import type { FixtureSet } from "../content/fixture-source";
import type {
  CaseStudyView,
  HomePageView,
  IndustryView,
  InsightView,
  JobView,
  OfferView,
  PersonView,
  PracticeView,
  RoutePageViewFor,
  SolutionView,
} from "../content/types";
import type { RoutePageKey } from "../routes";
import { caseStudyDrafts } from "./content/work";
import { jobDrafts } from "./content/careers";
import { insightDrafts } from "./content/insights";
import { personDrafts, personId } from "./content/people";
import { industryDrafts } from "./content/industries";
import type { IndustryDraft } from "./content/industries";
import { labDrafts } from "./content/labs";
import { legalDrafts } from "./content/legal";
import { offerDrafts } from "./content/offers";
import type { OfferDraft } from "./content/offers";
import { homeHeadings, homeProvenance, routePageDrafts, settingsDraft } from "./content/pages";
import { practiceDrafts } from "./content/practices";
import type { PracticeDraft } from "./content/practices";
import { solutionDrafts } from "./content/solutions";
import type { SolutionDraft } from "./content/solutions";
import { trustDrafts } from "./content/trust";
import { ctas } from "../locked-copy";
import { cta } from "./build";
import type { DraftProvenance } from "./provenance";
import { singletonProvenanceKeys } from "./provenance";
import { DRAFTED_ON, draftId } from "./slugs";
import type { IndustrySlug, OfferSlug, PracticeSlug, SolutionSlug } from "./slugs";

/** A draft content set: the in-memory views plus provenance for every document. */
export interface DraftContentSet {
  set: FixtureSet;
  /** Keyed by document id, or by `singletonProvenanceKeys` for documents without one. */
  provenance: Readonly<Record<string, DraftProvenance>>;
  /**
   * Route pages forced `noindex` only because placeholder documents are the sole content of their
   * section. The repo source drops that flag because it drops the placeholders.
   */
  placeholderNoindexRoutes: readonly RoutePageKey[];
}

const union = <T>(...lists: readonly (readonly T[])[]): T[] => [...new Set(lists.flat())];

/** Keeps `order`'s order, restricted to the members of `pick`. */
const inOrder = <T>(order: readonly T[], pick: readonly T[]): T[] =>
  order.filter((item) => pick.includes(item));

function strip<D extends { provenance: DraftProvenance }>(draft: D): Omit<D, "provenance"> {
  const rest: Record<string, unknown> = { ...draft };
  delete rest["provenance"];
  return rest as Omit<D, "provenance">;
}

/** A copy of `value` without the named keys. */
function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const rest: Partial<T> = { ...value };
  for (const key of keys) delete rest[key];
  return rest as Omit<T, K>;
}

export function buildDraftContentSet(): DraftContentSet {
  const practiceOrder = practiceDrafts.map((d) => d.slug);
  const solutionOrder = solutionDrafts.map((d) => d.slug);
  const offerOrder = offerDrafts.map((d) => d.slug);
  const industryOrder = industryDrafts.map((d) => d.slug);

  /* Relation indexes, both directions. */
  const solutionsOfPractice = (slug: PracticeSlug): SolutionSlug[] =>
    inOrder(
      solutionOrder,
      union(
        practiceDrafts.find((d) => d.slug === slug)?.solutions ?? [],
        solutionDrafts.filter((s) => s.practices.includes(slug)).map((s) => s.slug),
      ),
    );
  const practicesOfSolution = (slug: SolutionSlug): PracticeSlug[] =>
    practiceOrder.filter((practice) => solutionsOfPractice(practice).includes(slug));
  const offersOfSolution = (slug: SolutionSlug): OfferSlug[] =>
    inOrder(
      offerOrder,
      union(
        solutionDrafts.find((d) => d.slug === slug)?.offers ?? [],
        offerDrafts.filter((o) => o.solutions.includes(slug)).map((o) => o.slug),
      ),
    );
  const solutionsOfOffer = (slug: OfferSlug): SolutionSlug[] =>
    solutionOrder.filter((solution) => offersOfSolution(solution).includes(slug));
  const offersOfPractice = (slug: PracticeSlug): OfferSlug[] =>
    offerOrder.filter((offer) =>
      offerDrafts.find((o) => o.slug === offer)?.practices.includes(slug),
    );
  const industriesOfSolution = (slug: SolutionSlug): IndustrySlug[] =>
    inOrder(
      industryOrder,
      union(
        solutionDrafts.find((d) => d.slug === slug)?.industries ?? [],
        industryDrafts.filter((i) => i.solutions.includes(slug)).map((i) => i.slug),
      ),
    );
  const solutionsOfIndustry = (slug: IndustrySlug): SolutionSlug[] =>
    solutionOrder.filter((solution) => industriesOfSolution(solution).includes(slug));

  /* Views without relations first, so summaries can be taken from them. */
  const practiceBase = (d: PracticeDraft): PracticeView => ({
    ...strip(d),
    id: draftId("practice", d.slug),
    updatedAt: DRAFTED_ON,
    solutions: [],
    offers: [],
    industries: [],
    work: [],
  });
  const solutionBase = (d: SolutionDraft): SolutionView => ({
    ...strip(d),
    id: draftId("solution", d.slug),
    updatedAt: DRAFTED_ON,
    offers: [],
    practices: [],
    industries: [],
    work: [],
  });
  const offerBase = (d: OfferDraft): OfferView => ({
    ...strip(d),
    id: draftId("offer", d.slug),
    updatedAt: DRAFTED_ON,
    solutions: [],
    practices: [],
  });
  const industryBase = (d: IndustryDraft): IndustryView => ({
    ...strip(d),
    id: draftId("industry", d.slug),
    updatedAt: DRAFTED_ON,
    solutions: [],
    offers: [],
    work: [],
    insights: [],
  });

  const practiceSummary = new Map(
    practiceDrafts.map((d) => [d.slug, summaryOf("practice", practiceBase(d))]),
  );
  const solutionSummary = new Map(
    solutionDrafts.map((d) => [d.slug, summaryOf("solution", solutionBase(d))]),
  );
  const offerSummary = new Map(offerDrafts.map((d) => [d.slug, summaryOf("offer", offerBase(d))]));
  const industrySummary = new Map(
    industryDrafts.map((d) => [d.slug, summaryOf("industry", industryBase(d))]),
  );
  const pick = <K, V>(map: Map<K, V>, keys: readonly K[]): V[] =>
    keys.flatMap((key) => {
      const value = map.get(key);
      return value === undefined ? [] : [value];
    });

  const practices: PracticeView[] = practiceDrafts.map((d) => ({
    ...practiceBase(d),
    solutions: pick(solutionSummary, solutionsOfPractice(d.slug)),
    offers: pick(offerSummary, offersOfPractice(d.slug)),
    industries: pick(industrySummary, inOrder(industryOrder, d.industries)),
  }));
  const solutions: SolutionView[] = solutionDrafts.map((d) => ({
    ...solutionBase(d),
    offers: pick(offerSummary, offersOfSolution(d.slug)),
    practices: pick(practiceSummary, practicesOfSolution(d.slug)),
    industries: pick(industrySummary, industriesOfSolution(d.slug)),
  }));
  const offers: OfferView[] = offerDrafts.map((d) => ({
    ...offerBase(d),
    solutions: pick(solutionSummary, solutionsOfOffer(d.slug)),
    practices: pick(practiceSummary, inOrder(practiceOrder, d.practices)),
  }));
  const industries: IndustryView[] = industryDrafts.map((d) => ({
    ...industryBase(d),
    solutions: pick(solutionSummary, solutionsOfIndustry(d.slug)),
    offers: pick(offerSummary, inOrder(offerOrder, d.offers)),
  }));

  /* Placeholder personas, insights, case studies and role (owner directive of 11 October 2026). */
  const personBase = (d: (typeof personDrafts)[number]): PersonView => ({
    ...strip(d),
    id: personId(d.slug),
    insights: [],
  });
  const personSummary = new Map(
    personDrafts.map((d) => [d.slug, summaryOf("person", personBase(d))]),
  );
  const insightBase = (d: (typeof insightDrafts)[number]): InsightView => {
    const rest = omit(strip(d), "authors", "related");
    return {
      ...rest,
      id: draftId("insight", d.slug),
      authors: pick(personSummary, d.authors),
      related: [],
    };
  };
  const insightSummary = new Map(
    insightDrafts.map((d) => [d.slug, summaryOf("insight", insightBase(d))]),
  );
  const insights: InsightView[] = insightDrafts.map((d) => ({
    ...insightBase(d),
    related: pick(insightSummary, d.related),
  }));
  const people: PersonView[] = personDrafts.map((d) => ({
    ...personBase(d),
    insights: pick(
      insightSummary,
      insightDrafts.filter((i) => i.authors.includes(d.slug)).map((i) => i.slug),
    ),
  }));
  const caseStudies: CaseStudyView[] = caseStudyDrafts.map((d) => ({
    ...strip(d),
    id: draftId("caseStudy", d.slug),
    practices: pick(practiceSummary, d.practices),
    solutions: pick(solutionSummary, d.solutions),
    industries: pick(industrySummary, d.industries),
  }));
  const jobs: JobView[] = jobDrafts.map((d) => {
    return { ...omit(strip(d), "practice"), id: draftId("job", d.slug) };
  });

  const trustItems = trustDrafts.map((d) => d.view);
  const labAssets = labDrafts.map((d) => d.view);
  const legalPages = legalDrafts.map((d) => d.view);

  const home: HomePageView = {
    seo: { description: settingsDraft.view.defaultSeo?.description ?? "" },
    headings: homeHeadings,
    proof: [],
    // Stage 8 §8: the five client-problem-led solutions (the locked initial five).
    solutions: pick(solutionSummary, solutionOrder.slice(0, 5)),
    practices: pick(practiceSummary, practiceOrder),
    selectedWork: [],
    industries: pick(industrySummary, industryOrder),
    // Stage 9 §20: one or two technical proof assets.
    labs: labAssets.slice(0, 2).map((lab) => summaryOf("labAsset", lab)),
    insights: [],
    finalCta: cta(ctas.primary, "general"),
  };

  const routePages: FixtureSet["routePages"] = {};
  for (const [key, draft] of Object.entries(routePageDrafts)) {
    (routePages as Record<string, RoutePageViewFor<RoutePageKey>>)[key] = draft.view;
  }
  /* A section index whose only content is placeholder content is not indexable either. */
  const onlyPlaceholders = (list: readonly { placeholder?: true }[]) =>
    list.length > 0 && list.every((doc) => doc.placeholder === true);
  const placeholderNoindexRoutes: RoutePageKey[] = [];
  for (const [key, list] of [
    ["work", caseStudies],
    ["insights", insights],
    ["careers", jobs],
  ] as const) {
    const page = routePages[key];
    if (page && onlyPlaceholders(list)) {
      (routePages as Record<string, RoutePageViewFor<RoutePageKey>>)[key] = {
        ...page,
        seo: { ...page.seo, noindex: true },
      };
      placeholderNoindexRoutes.push(key);
    }
  }

  const provenance: Record<string, DraftProvenance> = {
    [singletonProvenanceKeys.siteSettings]: settingsDraft.provenance,
    [singletonProvenanceKeys.homePage]: homeProvenance,
  };
  for (const [key, draft] of Object.entries(routePageDrafts)) {
    provenance[singletonProvenanceKeys.routePage(key)] = draft.provenance;
  }
  const record = (id: string, entry: DraftProvenance) => {
    if (provenance[id]) throw new Error(`Duplicate draft id: ${id}`);
    provenance[id] = entry;
  };
  practiceDrafts.forEach((d) => record(draftId("practice", d.slug), d.provenance));
  solutionDrafts.forEach((d) => record(draftId("solution", d.slug), d.provenance));
  offerDrafts.forEach((d) => record(draftId("offer", d.slug), d.provenance));
  industryDrafts.forEach((d) => record(draftId("industry", d.slug), d.provenance));
  trustDrafts.forEach((d) => record(d.view.id, d.provenance));
  labDrafts.forEach((d) => record(d.view.id, d.provenance));
  legalDrafts.forEach((d) => record(d.view.id, d.provenance));
  personDrafts.forEach((d) => record(personId(d.slug), d.provenance));
  insightDrafts.forEach((d) => record(draftId("insight", d.slug), d.provenance));
  caseStudyDrafts.forEach((d) => record(draftId("caseStudy", d.slug), d.provenance));
  jobDrafts.forEach((d) => record(draftId("job", d.slug), d.provenance));

  return {
    set: {
      name: "draft",
      settings: settingsDraft.view,
      home,
      routePages,
      documents: {
        practice: practices,
        solution: solutions,
        offer: offers,
        industry: industries,
        caseStudy: caseStudies,
        insight: insights,
        person: people,
        labAsset: labAssets,
        trustItem: trustItems,
        job: jobs,
        legalPage: legalPages,
      },
    },
    provenance,
    placeholderNoindexRoutes,
  };
}
