import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  gateForKind,
  hrefForRoutePage,
  isSitemapEligible,
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
  const [gates, home, pages, entries] = await Promise.all([
    source.getPublicationGates(),
    source.getHomePage(),
    Promise.all(routePageKeys.map(async (key) => [key, await source.getRoutePage(key)] as const)),
    source.getSitemapEntries(),
  ]);
  return buildSitemap({
    siteUrl,
    gates,
    hasHome: home !== null,
    routePages: new Set(pages.filter(([, page]) => page !== null).map(([key]) => key)),
    entries,
  });
}
