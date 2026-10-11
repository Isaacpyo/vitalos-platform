/**
 * The content boundary of the platform. The web app depends only on this interface;
 * Sanity, fixtures and the empty source are interchangeable implementations.
 *
 * Empty-content policy (ADR-022): a missing detail document yields `null` (the page calls
 * `notFound()`); a section without data renders nothing; draft/preview mode may show a
 * `ContentGap` notice. There is no placeholder copy.
 */
import { closedGates } from "./gates";
import type { PublicationGates } from "./gates";
import type { LabType, LegalSlug, RoutePageKey, TrustTopic } from "../routes";
import type {
  DocKind,
  HomePageView,
  RoutePageViewFor,
  SiteChromeView,
  SitemapEntry,
  SummaryFor,
  ViewFor,
} from "./types";

export interface ReadOpts {
  /** Read draft content (draft mode only; requires a read token). */
  preview?: boolean;
}

/**
 * Slug parameter of `getDocument`. Trust items are addressed by their topic and legal pages by
 * their fixed slug, so the compiler rejects anything else.
 */
export type SlugFor<T extends DocKind> = T extends "trustItem"
  ? TrustTopic
  : T extends "legalPage"
    ? LegalSlug
    : string;

/**
 * Lab asset slugs are only unique within a lab type (`/labs/[type]/[slug]`), so a lab asset
 * lookup must say which type it means. Every other kind takes the plain `ReadOpts`.
 */
export type GetDocumentArgs<T extends DocKind> = T extends "labAsset"
  ? [o: ReadOpts & { labType: LabType }]
  : [o?: ReadOpts];

export interface ContentSource {
  getSiteChrome(o?: ReadOpts): Promise<SiteChromeView>;
  getHomePage(o?: ReadOpts): Promise<HomePageView | null>;
  getRoutePage<K extends RoutePageKey>(key: K, o?: ReadOpts): Promise<RoutePageViewFor<K> | null>;
  getDocument<T extends DocKind>(
    kind: T,
    slug: SlugFor<T>,
    ...args: GetDocumentArgs<T>
  ): Promise<ViewFor<T> | null>;
  listSummaries<T extends DocKind>(kind: T, o?: ReadOpts): Promise<SummaryFor<T>[]>;
  /** Route params for `generateStaticParams`, e.g. `{ slug }` or `{ type, slug }`. */
  listParams(kind: DocKind): Promise<Record<string, string>[]>;
  getSitemapEntries(): Promise<SitemapEntry[]>;
  getPublicationGates(o?: ReadOpts): Promise<PublicationGates>;
}

/**
 * Honest empty state: no documents, every gate closed, no settings. Used when no CMS is
 * configured so the platform builds and runs without Sanity.
 */
export class EmptyContentSource implements ContentSource {
  getSiteChrome(): Promise<SiteChromeView> {
    return Promise.resolve({ settings: {}, gates: closedGates });
  }
  getHomePage(): Promise<HomePageView | null> {
    return Promise.resolve(null);
  }
  getRoutePage<K extends RoutePageKey>(): Promise<RoutePageViewFor<K> | null> {
    return Promise.resolve(null);
  }
  getDocument<T extends DocKind>(): Promise<ViewFor<T> | null> {
    return Promise.resolve(null);
  }
  listSummaries<T extends DocKind>(): Promise<SummaryFor<T>[]> {
    return Promise.resolve([]);
  }
  listParams(): Promise<Record<string, string>[]> {
    return Promise.resolve([]);
  }
  getSitemapEntries(): Promise<SitemapEntry[]> {
    return Promise.resolve([]);
  }
  getPublicationGates(): Promise<PublicationGates> {
    return Promise.resolve(closedGates);
  }
}
