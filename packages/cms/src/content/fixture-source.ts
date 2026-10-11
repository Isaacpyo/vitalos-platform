/**
 * An in-memory `ContentSource` over a fixture set of view models.
 *
 * Fixtures are obviously artificial and are forbidden in production (`@vitalos/config` rejects
 * VITALOS_CONTENT_SOURCE=fixtures there). The source applies the same publication rules as the
 * Sanity source: closed gates keep their pages reachable but out of the sitemap, closed roles keep
 * their page but leave the index, and `noindex` documents stay out of the sitemap.
 */
import { evaluateGates, gateForKind, isSitemapEligible } from "./gates";
import type { PublicationGates } from "./gates";
import { isJobOpenOn, isJobSitemapEligible, labTypeSitemapEntries } from "./sitemap-rules";
import { clean, paramsFromSummaries } from "./mappers";
import type { ContentSource, GetDocumentArgs, ReadOpts, SlugFor } from "./source";
import { hrefForDocument } from "../routes";
import type { DocumentRef, LabType, RoutePageKey } from "../routes";
import type {
  CaseStudySummary,
  DocKind,
  HomePageView,
  JobSummary,
  JobView,
  OfferSummary,
  PersonSummary,
  RoutePageViewFor,
  SiteChromeView,
  SiteSettingsView,
  SitemapEntry,
  SummaryFor,
  TrustTopicSummary,
  ViewFor,
} from "./types";

export type FixtureSetName = "full" | "sparse";

export interface FixtureSet {
  /** `draft` is the repo-authored draft content set (ADR-025), served by the same in-memory source. */
  name: FixtureSetName | "draft" | "repo";
  settings: SiteSettingsView;
  home: HomePageView | null;
  routePages: { [K in RoutePageKey]?: RoutePageViewFor<K> };
  documents: { [K in DocKind]: readonly ViewFor<K>[] };
}

export interface FixtureContentSourceOptions {
  /** Clock for job validity. Defaults to the real time. */
  now?: () => Date;
  /**
   * Count case studies flagged `placeholder` towards the Work gate even though their evidence is
   * not verified. Only the draft content source sets this (ADR-025); the fixtures, the sparse set
   * and the Sanity source never do, so the production rule (verified evidence only) is unchanged.
   */
  countPlaceholderCaseStudies?: boolean;
}

const base = (view: {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  placeholder?: true;
}) =>
  clean<{ id: string; slug: string; title: string; summary?: string; placeholder?: true }>({
    id: view.id,
    slug: view.slug,
    title: view.title,
    summary: view.summary,
    placeholder: view.placeholder,
  });

/** The summary a view would have been listed with. Used by the fixture source and fixture builders. */
export function summaryOf<K extends DocKind>(kind: K, view: ViewFor<K>): SummaryFor<K> {
  const v = view as ViewFor<DocKind>;
  switch (kind) {
    case "offer": {
      const offer = v as ViewFor<"offer">;
      return clean<OfferSummary>({
        ...base(offer),
        durationCategory: offer.durationCategory || undefined,
      }) as SummaryFor<K>;
    }
    case "caseStudy": {
      const study = v as ViewFor<"caseStudy">;
      return clean<CaseStudySummary>({
        ...base(study),
        engagementBasis: study.engagementBasis,
        clientLabel: study.clientDisplay === "named" ? study.clientName : study.sector,
      }) as SummaryFor<K>;
    }
    case "insight": {
      const insight = v as ViewFor<"insight">;
      return {
        ...base(insight),
        format: insight.format,
        publishedAt: insight.publishedAt,
        authors: insight.authors,
      } as SummaryFor<K>;
    }
    case "person": {
      const person = v as ViewFor<"person">;
      return clean<PersonSummary>({
        ...base(person),
        role: person.role,
        portrait: person.portrait,
      }) as SummaryFor<K>;
    }
    case "labAsset": {
      const lab = v as ViewFor<"labAsset">;
      return {
        ...base(lab),
        labType: lab.labType,
        maturity: lab.maturity,
      } as SummaryFor<K>;
    }
    case "trustItem": {
      const trust = v as ViewFor<"trustItem">;
      return clean<TrustTopicSummary>({
        id: trust.id,
        topic: trust.topic,
        title: trust.title,
        summary: trust.summary,
      }) as SummaryFor<K>;
    }
    case "job": {
      const job = v as ViewFor<"job">;
      return clean<JobSummary>({
        ...base(job),
        location: job.location,
        employmentType: job.employmentType,
      }) as SummaryFor<K>;
    }
    case "legalPage": {
      const legal = v as ViewFor<"legalPage">;
      return { id: legal.id, slug: legal.slug, title: legal.title } as SummaryFor<K>;
    }
    default:
      return base(v as ViewFor<"practice">) as SummaryFor<K>;
  }
}

const kinds: readonly DocKind[] = [
  "practice",
  "solution",
  "offer",
  "industry",
  "caseStudy",
  "insight",
  "person",
  "labAsset",
  "trustItem",
  "job",
  "legalPage",
];

const jobIsOpen = (job: JobView, today: string): boolean => isJobOpenOn(job, today);

export function createFixtureSource(
  set: FixtureSet,
  options: FixtureContentSourceOptions = {},
): ContentSource {
  const now = options.now ?? (() => new Date());
  const today = () => now().toISOString().slice(0, 10);

  const views = <K extends DocKind>(kind: K): readonly ViewFor<K>[] => set.documents[kind];

  const gates = (): PublicationGates => {
    const t = today();
    return evaluateGates({
      work: views("caseStudy").filter(
        (study) =>
          study.evidence.status === "verified" ||
          (options.countPlaceholderCaseStudies === true && study.placeholder === true),
      ).length,
      insights: views("insight").filter((insight) => insight.authors.length > 0).length,
      labs: views("labAsset").length,
      industries: views("industry").length,
      careers: views("job").filter((job) => jobIsOpen(job, t)).length,
    });
  };

  const summaries = <K extends DocKind>(kind: K): SummaryFor<K>[] => {
    const t = today();
    const list = kind === "job" ? views("job").filter((job) => jobIsOpen(job, t)) : views(kind);
    return list.map((view) => summaryOf(kind, view as ViewFor<K>));
  };

  const source: ContentSource = {
    getSiteChrome(): Promise<SiteChromeView> {
      return Promise.resolve({ settings: set.settings, gates: gates() });
    },
    getHomePage(): Promise<HomePageView | null> {
      return Promise.resolve(set.home);
    },
    getRoutePage<K extends RoutePageKey>(key: K): Promise<RoutePageViewFor<K> | null> {
      const page = set.routePages[key] as RoutePageViewFor<K> | undefined;
      if (!page) return Promise.resolve(null);
      // The trust overview lists the trust topics that exist, so it can never drift from them.
      if (key === "trust") {
        return Promise.resolve({ ...page, topics: summaries("trustItem") } as RoutePageViewFor<K>);
      }
      return Promise.resolve(page);
    },
    getDocument<T extends DocKind>(
      kind: T,
      slug: SlugFor<T>,
      ...args: GetDocumentArgs<T>
    ): Promise<ViewFor<T> | null> {
      const opts = args[0] as (ReadOpts & { labType?: LabType }) | undefined;
      const found = views(kind).find((view) => {
        const doc = view as ViewFor<DocKind>;
        if (kind === "trustItem") return (doc as ViewFor<"trustItem">).topic === slug;
        if (kind === "labAsset") {
          const lab = doc as ViewFor<"labAsset">;
          return lab.slug === slug && lab.labType === opts?.labType;
        }
        return (doc as ViewFor<"practice">).slug === slug;
      });
      return Promise.resolve(found ?? null);
    },
    listSummaries<T extends DocKind>(kind: T): Promise<SummaryFor<T>[]> {
      return Promise.resolve(summaries(kind));
    },
    listParams(kind: DocKind): Promise<Record<string, string>[]> {
      // Closed roles keep their page, so params cover every job, open or closed.
      const all = views(kind).map((view) => summaryOf(kind, view));
      return Promise.resolve(
        paramsFromSummaries(kind, all as unknown as Record<string, unknown>[]),
      );
    },
    getSitemapEntries(): Promise<SitemapEntry[]> {
      const open = gates();
      const t = today();
      const entries: SitemapEntry[] = [];
      const labAssets: { labType: string; updatedAt: string | undefined }[] = [];
      for (const kind of kinds) {
        if (!isSitemapEligible(gateForKind(kind), open)) continue;
        for (const view of views(kind)) {
          const doc = view;
          if ("seo" in doc && doc.seo.noindex === true) continue;
          // A case study without verified evidence has no public page (the route answers 404).
          if (
            kind === "caseStudy" &&
            (doc as ViewFor<"caseStudy">).evidence.status !== "verified"
          ) {
            continue;
          }
          if (kind === "job" && !isJobSitemapEligible(doc as ViewFor<"job">, t)) continue;
          const ref = documentRef(kind, doc);
          if (ref.kind === "labAsset") {
            labAssets.push({
              labType: ref.labType,
              updatedAt: (doc as ViewFor<"labAsset">).updatedAt,
            });
          }
          entries.push(
            clean<SitemapEntry>({
              path: hrefForDocument(ref),
              kind,
              lastModified: "updatedAt" in doc ? doc.updatedAt : undefined,
            }),
          );
        }
      }
      entries.push(...labTypeSitemapEntries(labAssets, open));
      return Promise.resolve(entries);
    },
    getPublicationGates(): Promise<PublicationGates> {
      return Promise.resolve(gates());
    },
  };
  return source;
}

function documentRef(kind: DocKind, doc: ViewFor<DocKind>): DocumentRef {
  switch (kind) {
    case "labAsset": {
      const lab = doc as ViewFor<"labAsset">;
      return { kind, labType: lab.labType, slug: lab.slug };
    }
    case "trustItem":
      return { kind, slug: (doc as ViewFor<"trustItem">).topic };
    case "legalPage":
      return { kind, slug: (doc as ViewFor<"legalPage">).slug };
    default:
      return { kind, slug: (doc as ViewFor<"practice">).slug };
  }
}
