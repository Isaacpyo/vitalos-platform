/**
 * Maps a Sanity document to its public path using routes.ts, the single source of URLs.
 * Used by Presentation resolvers, the slug-change redirect action and the slug warning.
 */
import {
  hrefForDocument,
  hrefForRoutePage,
  isValidSlug,
  labTypes,
  legalSlugs,
  routePageKeys,
  routes,
  trustTopics,
  type LabType,
  type LegalSlug,
  type RoutePageKey,
  type TrustTopic,
} from "../routes";

export interface HrefSource {
  slug?: { current?: string } | string | null;
  labType?: string | null;
  topic?: string | null;
  routeKey?: string | null;
}

const slugOf = (source: HrefSource): string | undefined => {
  const raw = typeof source.slug === "string" ? source.slug : source.slug?.current;
  return raw && isValidSlug(raw) ? raw : undefined;
};

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** Public path of a document, or null when it has no (valid) route yet. */
export function documentHref(type: string, source: HrefSource): string | null {
  const slug = slugOf(source);
  switch (type) {
    case "practice":
    case "solution":
    case "offer":
    case "industry":
    case "caseStudy":
    case "insight":
    case "person":
    case "job":
      return slug ? hrefForDocument({ kind: type, slug }) : null;
    case "labAsset":
      return slug && includes<LabType>(labTypes, source.labType)
        ? hrefForDocument({ kind: "labAsset", labType: source.labType, slug })
        : null;
    case "trustItem":
      return includes<TrustTopic>(trustTopics, source.topic)
        ? hrefForDocument({ kind: "trustItem", slug: source.topic })
        : null;
    case "legalPage": {
      const legal = typeof source.slug === "string" ? source.slug : source.slug?.current;
      return includes<LegalSlug>(legalSlugs, legal)
        ? hrefForDocument({ kind: "legalPage", slug: legal })
        : null;
    }
    case "routePage":
      return includes<RoutePageKey>(routePageKeys, source.routeKey)
        ? hrefForRoutePage(source.routeKey)
        : null;
    case "homePage":
      return routes.home();
    default:
      return null;
  }
}

export interface SlugChange {
  from: string;
  to: string;
}

/**
 * The public URL change caused by editing a published document, or null when nothing a visitor
 * could have bookmarked changed (never published, no route, or same URL).
 */
export function plannedUrlChange(
  type: string,
  published: HrefSource | null | undefined,
  draft: HrefSource | null | undefined,
): SlugChange | null {
  if (!published || !draft) return null;
  const from = documentHref(type, published);
  const to = documentHref(type, draft);
  if (from === null || to === null || from === to) return null;
  return { from, to };
}
