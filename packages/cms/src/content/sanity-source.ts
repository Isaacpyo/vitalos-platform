/**
 * The Sanity-backed `ContentSource`.
 *
 * It owns no Sanity client: the web app injects a `fetcher` that runs a GROQ query with the given
 * params (adding caching tags, the draft perspective and the read token as appropriate) and
 * returns the raw result. This keeps the Studio SDK and secrets out of this package and lets
 * tests substitute a fake. Query results are untrusted: every result goes through the mappers,
 * which re-check public safety.
 */
import {
  detailQueries,
  gateCountsQuery,
  homePageQuery,
  routePageQuery,
  siteSettingsQuery,
  sitemapQuery,
  summariesQueries,
} from "../queries/registry";
import { cmsDocumentTag, cmsTypeTag, statusesFor, todayIso } from "../queries/params";
import type { QueryParams } from "../queries/params";
import { isValidSlug, labTypes, legalSlugs, trustTopics } from "../routes";
import type { LabType, RoutePageKey } from "../routes";
import type { PublicationGates } from "./gates";
import * as m from "./mappers";
import type { MapContext } from "./mappers";
import type { ContentSource, GetDocumentArgs, ReadOpts, SlugFor } from "./source";
import type {
  DocKind,
  HomePageView,
  RoutePageViewFor,
  SiteChromeView,
  SitemapEntry,
  SummaryFor,
  ViewFor,
} from "./types";

export interface SanityFetchOptions {
  /** Read the draft perspective (needs a read token); never cached. */
  preview?: boolean;
  /** Cache tags for this read (`sanity:<type>`, `sanity:<type>:<slug>`); the fetcher adds the root tag. */
  tags?: readonly string[];
}

/** Runs a GROQ query and returns the raw result. The web app supplies the cached/draft fetcher. */
export type SanityFetcher = (
  query: string,
  params: Record<string, unknown>,
  opts: SanityFetchOptions,
) => Promise<unknown>;

export interface SanityContentSourceOptions {
  /** Clock for expiry checks (job validity, certification expiry). Defaults to the real time. */
  now?: () => Date;
}

interface KindSpec {
  mapDetail: (raw: never, ctx: MapContext) => unknown;
  mapSummaries: (raw: never, ctx: MapContext) => unknown[];
  /** Summaries used for static params; differs from `mapSummaries` only for jobs (closed roles keep their page). */
  mapParams?: (raw: never, ctx: MapContext) => unknown[];
}

/** `(raw, ctx) => view` mappers accept loosely-typed raw data; the source validated nothing yet. */
const summariesOf =
  <R, V extends { id: string }>(map: (raw: R, ctx: MapContext) => V | undefined) =>
  (raw: unknown, ctx: MapContext): V[] =>
    m.mapSummaries(asList(raw) as readonly R[], map, ctx);

const asList = (raw: unknown): readonly unknown[] => (Array.isArray(raw) ? raw : []);
const asRecord = (raw: unknown): Record<string, unknown> | null =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;

const specs: Record<DocKind, KindSpec> = {
  practice: {
    mapDetail: m.mapPractice,
    mapSummaries: summariesOf(m.mapBasicSummary),
  },
  solution: {
    mapDetail: m.mapSolution,
    mapSummaries: summariesOf(m.mapBasicSummary),
  },
  offer: {
    mapDetail: m.mapOffer,
    mapSummaries: summariesOf(m.mapOfferSummary),
  },
  industry: {
    mapDetail: m.mapIndustry,
    mapSummaries: summariesOf(m.mapBasicSummary),
  },
  caseStudy: {
    mapDetail: m.mapCaseStudy,
    mapSummaries: summariesOf(m.mapCaseStudySummary),
  },
  insight: {
    mapDetail: m.mapInsight,
    mapSummaries: summariesOf(m.mapInsightSummary),
  },
  person: {
    mapDetail: m.mapPerson,
    mapSummaries: summariesOf(m.mapPersonSummary),
  },
  labAsset: {
    mapDetail: m.mapLabAsset,
    mapSummaries: summariesOf(m.mapLabAssetSummary),
  },
  trustItem: {
    mapDetail: m.mapTrustItem,
    mapSummaries: summariesOf(m.mapTrustTopicSummary),
  },
  job: {
    mapDetail: m.mapJob,
    // The careers index lists open, unexpired roles only; closed roles keep their page.
    mapSummaries: (raw: unknown, ctx: MapContext) =>
      m.mapOpenJobSummaries(asList(raw) as never, ctx),
    mapParams: summariesOf(m.mapJobSummary),
  },
  legalPage: {
    mapDetail: m.mapLegalPage,
    mapSummaries: summariesOf(m.mapLegalPageSummary),
  },
};

/** Query params for one detail lookup, or null when the identifier cannot match any document. */
function detailParams(
  kind: DocKind,
  slug: string,
  opts: { labType?: LabType } | undefined,
): Record<string, unknown> | null {
  switch (kind) {
    case "trustItem":
      return (trustTopics as readonly string[]).includes(slug) ? { topic: slug } : null;
    case "legalPage":
      return (legalSlugs as readonly string[]).includes(slug) ? { slug } : null;
    case "labAsset": {
      const labType = opts?.labType;
      return isValidSlug(slug) && labType !== undefined && labTypes.includes(labType)
        ? { slug, labType }
        : null;
    }
    default:
      return isValidSlug(slug) ? { slug } : null;
  }
}

/** Document types behind each publication gate; a change to any of them can move a gate. */
const gatedTypes = ["caseStudy", "insight", "labAsset", "industry", "job"] as const;
const docTypes = Object.keys(specs) as DocKind[];

class SanityContentSource implements ContentSource {
  constructor(
    private readonly fetcher: SanityFetcher,
    private readonly now: () => Date,
  ) {}

  private context(o: ReadOpts | undefined): { ctx: MapContext; base: QueryParams } {
    const preview = o?.preview === true;
    const statuses = statusesFor(preview);
    const today = todayIso(this.now());
    return { ctx: { statuses, today, preview }, base: { statuses, today } };
  }

  private run(
    query: string,
    o: ReadOpts | undefined,
    extra: Record<string, unknown> = {},
    tags: readonly string[] = [],
  ): { result: Promise<unknown>; ctx: MapContext } {
    const { ctx, base } = this.context(o);
    return {
      result: this.fetcher(query, { ...base, ...extra }, { preview: ctx.preview, tags }),
      ctx,
    };
  }

  async getSiteChrome(o?: ReadOpts): Promise<SiteChromeView> {
    const settingsRun = this.run(siteSettingsQuery, o, {}, [cmsTypeTag("siteSettings")]);
    const [settings, gates] = await Promise.all([settingsRun.result, this.getPublicationGates(o)]);
    return { settings: m.mapSiteSettings(asRecord(settings), settingsRun.ctx), gates };
  }

  async getHomePage(o?: ReadOpts): Promise<HomePageView | null> {
    const { result, ctx } = this.run(homePageQuery, o, {}, [cmsTypeTag("homePage")]);
    return m.mapHomePage(asRecord(await result), ctx);
  }

  async getRoutePage<K extends RoutePageKey>(
    key: K,
    o?: ReadOpts,
  ): Promise<RoutePageViewFor<K> | null> {
    const { result, ctx } = this.run(routePageQuery, o, { key }, [
      cmsTypeTag("routePage"),
      cmsDocumentTag("routePage", key),
    ]);
    const raw = asRecord(await result);
    if (key === "contact") return m.mapContactPage(raw, ctx) as RoutePageViewFor<K> | null;
    if (key === "trust") {
      const topics = await this.listSummaries("trustItem", o);
      return m.mapTrustOverview(raw, topics, ctx) as RoutePageViewFor<K> | null;
    }
    return m.mapRoutePage(raw, key, ctx) as RoutePageViewFor<K> | null;
  }

  async getDocument<T extends DocKind>(
    kind: T,
    slug: SlugFor<T>,
    ...args: GetDocumentArgs<T>
  ): Promise<ViewFor<T> | null> {
    const opts = args[0] as (ReadOpts & { labType?: LabType }) | undefined;
    const params = detailParams(kind, slug, opts);
    if (params === null) return null;
    const spec = specs[kind];
    const { result, ctx } = this.run(detailQueries[kind], opts, params, [
      cmsTypeTag(kind),
      cmsDocumentTag(kind, String(params.slug ?? params.topic)),
    ]);
    const raw = asRecord(await result);
    return (spec.mapDetail as (raw: unknown, ctx: MapContext) => ViewFor<T> | null)(raw, ctx);
  }

  async listSummaries<T extends DocKind>(kind: T, o?: ReadOpts): Promise<SummaryFor<T>[]> {
    const spec = specs[kind];
    const { result, ctx } = this.run(summariesQueries[kind], o, {}, [cmsTypeTag(kind)]);
    return spec.mapSummaries((await result) as never, ctx) as SummaryFor<T>[];
  }

  async listParams(kind: DocKind): Promise<Record<string, string>[]> {
    const spec = specs[kind];
    const { result, ctx } = this.run(summariesQueries[kind], undefined, {}, [cmsTypeTag(kind)]);
    const map = spec.mapParams ?? spec.mapSummaries;
    return m.paramsFromSummaries(
      kind,
      map((await result) as never, ctx) as Record<string, unknown>[],
    );
  }

  async getPublicationGates(o?: ReadOpts): Promise<PublicationGates> {
    const raw = asRecord(await this.run(gateCountsQuery, o, {}, gatedTypes.map(cmsTypeTag)).result);
    return m.mapGateCounts(raw);
  }

  async getSitemapEntries(): Promise<SitemapEntry[]> {
    const sitemap = this.run(sitemapQuery, undefined, {}, docTypes.map(cmsTypeTag));
    const [gates, raw] = await Promise.all([this.getPublicationGates(), sitemap.result]);
    return m.mapSitemap(asRecord(raw) as m.RawSitemap | null, gates, sitemap.ctx);
  }
}

export function createSanityContentSource(
  fetcher: SanityFetcher,
  options: SanityContentSourceOptions = {},
): ContentSource {
  return new SanityContentSource(fetcher, options.now ?? (() => new Date()));
}
