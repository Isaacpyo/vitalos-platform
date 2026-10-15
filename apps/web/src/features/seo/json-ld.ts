import { absoluteUrl, brandName, routes } from "@vitalos/cms";
import type { ImageView, PersonView, SiteSettingsView } from "@vitalos/cms";
import { isSameOriginImage } from "../../lib/cms/images";

/**
 * Structured data builders (ADR-018). Rules:
 *
 *  - Pure functions of view models; nothing is read from the environment.
 *  - A property is emitted only when the content actually has it. Nothing is invented: no
 *    ratings, no addresses, no logo, no sameAs, no dates, no salary, no authors.
 *  - A builder returns `null` when the type cannot be described honestly (an Article without a
 *    named author or date; a JobPosting that is closed, expired or has no description).
 *
 * Organization and WebSite use only the brand name (locked copy) and the site URL (config) when
 * site settings are empty.
 */

export interface JsonLdNode {
  "@context"?: "https://schema.org";
  "@type": string;
  [property: string]: unknown;
}

export interface JsonLdContext {
  /** Origin of the site, no path. */
  siteUrl: string;
}

const CONTEXT = "https://schema.org" as const;

export const organizationId = (ctx: JsonLdContext): string =>
  absoluteUrl(ctx.siteUrl, "/#organization");
export const websiteId = (ctx: JsonLdContext): string => absoluteUrl(ctx.siteUrl, "/#website");

/** Drops properties that are undefined, null or empty strings/arrays. */
function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => {
      if (v === undefined || v === null) return false;
      if (typeof v === "string") return v.trim() !== "";
      if (Array.isArray(v)) return v.length > 0;
      return true;
    }),
  ) as T;
}

const isHttps = (value: string) => URL.canParse(value) && new URL(value).protocol === "https:";

/** Absolute URL for structured data: a same-site path is resolved against the site URL. */
const imageUrl = (ctx: JsonLdContext, src: string): string | undefined => {
  if (isSameOriginImage(src)) return absoluteUrl(ctx.siteUrl, src);
  return isHttps(src) ? src : undefined;
};

const imageObject = (ctx: JsonLdContext, image: ImageView | undefined) => {
  const url = image && !image.decorative ? imageUrl(ctx, image.url) : undefined;
  return image && url
    ? compact({ "@type": "ImageObject", url, width: image.width, height: image.height })
    : undefined;
};

/** Serialises for an inline `<script type="application/ld+json">`; `<` can never close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function organizationJsonLd(settings: SiteSettingsView, ctx: JsonLdContext): JsonLdNode {
  const logoUrl = settings.logo ? imageUrl(ctx, settings.logo.src) : undefined;
  const logo = settings.logo && logoUrl ? { ...settings.logo, src: logoUrl } : undefined;
  const sameAs = (settings.social ?? []).map((link) => link.href).filter(isHttps);
  return compact({
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": organizationId(ctx),
    name: brandName,
    legalName: settings.legalName,
    url: absoluteUrl(ctx.siteUrl, routes.home()),
    logo: logo
      ? compact({
          "@type": "ImageObject",
          url: logo.src,
          width: logo.width,
          height: logo.height,
        })
      : undefined,
    email: settings.contactEmail,
    // No address: the registered office is published only in the privacy notice (owner decision,
    // 12 Oct 2026), not in markup on every page.
    sameAs,
  }) as JsonLdNode;
}

export function webSiteJsonLd(ctx: JsonLdContext): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": websiteId(ctx),
    name: brandName,
    url: absoluteUrl(ctx.siteUrl, routes.home()),
    publisher: { "@id": organizationId(ctx) },
    inLanguage: "en-GB",
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Site path from routes.ts. */
  path: string;
}

/** Null for fewer than two crumbs: a single-item trail adds nothing. */
export function breadcrumbJsonLd(
  items: readonly BreadcrumbItem[],
  ctx: JsonLdContext,
): JsonLdNode | null {
  const crumbs = items.filter((item) => item.name.trim() !== "" && item.path.startsWith("/"));
  if (crumbs.length < 2) return null;
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(ctx.siteUrl, item.path),
    })),
  };
}

const validDate = (value: string | undefined) =>
  value !== undefined && !Number.isNaN(Date.parse(value)) ? value : undefined;

/** ProfilePage with a Person. `sameAs` carries verified profile links only (view contract). */
export function profilePageJsonLd(person: PersonView, ctx: JsonLdContext): JsonLdNode | null {
  // Placeholder personas (ADR-025) never emit a Person or ProfilePage.
  if (person.placeholder === true) return null;
  const url = absoluteUrl(ctx.siteUrl, routes.person(person.slug));
  return compact({
    "@context": CONTEXT,
    "@type": "ProfilePage",
    url,
    dateModified: validDate(person.updatedAt),
    mainEntity: compact({
      "@type": "Person",
      "@id": `${url}#person`,
      name: person.name,
      jobTitle: person.role,
      url,
      image: imageObject(ctx, person.portrait),
      sameAs: person.sameAs.filter(isHttps),
      worksFor: { "@id": organizationId(ctx) },
    }),
  }) as JsonLdNode;
}
