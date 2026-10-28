import type { MetadataRoute } from "next";
import { faqGroups } from "../faq/faq-groups";
import {
  absoluteUrl,
  aiDataSitemapPaths,
  gateForKind,
  hrefForRoutePage,
  isSitemapEligible,
  productPath,
  products,
  routePageKeys,
  routes,
} from "@vitalos/cms";
import type { ContentSource, PublicationGates, RoutePageKey, SitemapEntry } from "@vitalos/cms";
import {
  gateForPath,
  gateForRoutePage,
  manifestEntryForPath,
} from "../publication-gates/route-gates";

/**
 * Gate-aware sitemap (ADR-022). An URL is listed only when all of these hold:
 *
 *  - it exists: the home page and each index page are listed only when the content source has
 *    that document (an empty source yields an empty sitemap, never a list of 404s);
 *  - its section's publication gate is open (`isSitemapEligible`);
 *  - the path is a clean route from the manifest (no query, no fragment, no unknown route).
 *
 * The content source is responsible for returning only published documents and for leaving out
 * documents whose SEO says `noindex` from `getSitemapEntries()`.
 */

export interface SitemapInput {
  siteUrl: string;
  gates: PublicationGates;
  /** The home page document exists. */
  hasHome: boolean;
  /** Route-page keys whose singleton document exists. */
  routePages: ReadonlySet<RoutePageKey>;
  /** The FAQ page has questions (features/faq). */
  hasFaq?: boolean | undefined;
  /**
   * List the Vitalos AI & Data pages (code-authored, ungated; AID-002). `loadSitemap` sets it
   * while the site has a home page, so an empty content source still yields an empty sitemap.
   */
  aiData?: boolean | undefined;
  /** Document and route entries from `ContentSource.getSitemapEntries()`. */
  entries: readonly SitemapEntry[];
}

const cleanPath = (path: string) =>
  path.startsWith("/") && !path.startsWith("//") && !/[?#\\\s]/.test(path);

const asDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time);
};

export function buildSitemap(input: SitemapInput): MetadataRoute.Sitemap {
  const seen = new Map<string, { lastModified?: Date | undefined }>();
  const add = (path: string, lastModified?: Date) => {
    if (!seen.has(path)) seen.set(path, { lastModified });
  };

  if (input.hasHome) add(routes.home());

  for (const key of routePageKeys) {
    if (!input.routePages.has(key)) continue;
    if (!isSitemapEligible(gateForRoutePage(key), input.gates)) continue;
    add(hrefForRoutePage(key));
  }

  // Each product page, while its index is listed (the products live in @vitalos/cms, not the source).
  if (input.routePages.has("products")) for (const product of products) add(productPath(product));

  if (input.hasFaq) add(routes.faq());

  if (input.aiData) for (const path of aiDataSitemapPaths) add(path);

  for (const entry of input.entries) {
    if (!cleanPath(entry.path) || manifestEntryForPath(entry.path) === undefined) continue;
    const gate = gateForKind(entry.kind) ?? gateForPath(entry.path);
    if (!isSitemapEligible(gate, input.gates)) continue;
    add(entry.path, asDate(entry.lastModified));
  }

  return [...seen].map(([path, { lastModified }]) => ({
    url: absoluteUrl(input.siteUrl, path),
    ...(lastModified ? { lastModified } : {}),
  }));
}

/** Reads what the sitemap needs from a published-only content source. */
export async function loadSitemap(
  source: ContentSource,
  siteUrl: string,
): Promise<MetadataRoute.Sitemap> {
  const [gates, home, pages, entries, faq] = await Promise.all([
    source.getPublicationGates(),
    source.getHomePage(),
    Promise.all(routePageKeys.map(async (key) => [key, await source.getRoutePage(key)] as const)),
    source.getSitemapEntries(),
    faqGroups(source),
  ]);
  return buildSitemap({
    siteUrl,
    gates,
    hasHome: home !== null,
    hasFaq: faq.length > 0,
    aiData: home !== null,
    // A route page marked noindex (for example a section index whose only content is placeholder
    // content, ADR-025) is not listed.
    routePages: new Set(
      pages.filter(([, page]) => page !== null && page.seo.noindex !== true).map(([key]) => key),
    ),
    entries,
  });
}
