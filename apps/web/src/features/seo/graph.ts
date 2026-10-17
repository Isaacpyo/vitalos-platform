import { absoluteUrl, routes } from "@vitalos/cms";
import type { JsonLdContext, JsonLdNode } from "./json-ld";
import { organizationId, websiteId } from "./json-ld";
import { seoSite } from "./site";

/**
 * The JSON-LD `@graph` builder (docs/seo/DECISIONS.md 22). Each page emits one graph whose nodes
 * link by stable `@id`s:
 *
 *   {url}#webpage    WebPage (or CollectionPage, AboutPage, ContactPage; plus FAQPage when the
 *                    page shows its own questions), isPartOf the WebSite
 *   {url}#breadcrumb BreadcrumbList below the homepage
 *   {url}#service    Service on practice, solution and offer pages, provided by the Organization
 *   /#organization   Organization, described in full on the homepage and referenced elsewhere
 *   /#website        WebSite, on the homepage
 *   mainEntity       the page's questions (FAQPage), the ItemList an index page lists, or the
 *                    Person a profile page is about ({path}#person)
 *
 * Every value repeats what the page shows (its h1, its lead or summary, its questions), so the
 * markup never says more than the page. Pure functions; nothing is read from the environment.
 */

export type WebPageType =
  | "WebPage"
  | "CollectionPage"
  | "AboutPage"
  | "ContactPage"
  | "ProfilePage";

const pageUrl = (ctx: JsonLdContext, path: string) => absoluteUrl(ctx.siteUrl, path);
export const webPageId = (ctx: JsonLdContext, path: string) => `${pageUrl(ctx, path)}#webpage`;
export const breadcrumbId = (ctx: JsonLdContext, path: string) =>
  `${pageUrl(ctx, path)}#breadcrumb`;
export const serviceId = (ctx: JsonLdContext, path: string) => `${pageUrl(ctx, path)}#service`;

const present = (value: string | undefined) =>
  value !== undefined && value.trim() !== "" ? value.trim() : undefined;

const validDate = (value: string | undefined) =>
  value !== undefined && !Number.isNaN(Date.parse(value)) ? value : undefined;

export interface FaqItem {
  question: string;
  answer: string;
}

export interface WebPageInput {
  path: string;
  /** The page's h1. */
  name: string;
  /** Visible lead or summary text. */
  description?: string | undefined;
  type?: WebPageType | undefined;
  /** True when the page has a BreadcrumbList (every page below the homepage). */
  breadcrumb?: boolean | undefined;
  /** The page is about the Service on it (practice, solution and offer pages). */
  aboutService?: boolean | undefined;
  /** Questions and answers the page shows; adds FAQPage to the page type. */
  faq?: readonly FaqItem[] | undefined;
  /** Content date, when the document has one. */
  dateModified?: string | undefined;
  /**
   * The items an index page lists, in page order (C11): a `CollectionPage`'s `mainEntity` becomes
   * an `ItemList` of them. Ignored when the page has questions (FAQPage owns `mainEntity`).
   */
  items?: readonly ListedItem[] | undefined;
  /** A node the page is about, such as the Person on a profile page (`mainEntity`). */
  mainEntity?: JsonLdNode | undefined;
}

export interface ListedItem {
  /** The item's visible name. */
  name: string;
  /** Site path of the item's page. */
  path: string;
}

/** `ItemList` of the pages an index lists; null when it lists none. */
export function itemListNode(items: readonly ListedItem[], ctx: JsonLdContext): JsonLdNode | null {
  const listed = items.filter((item) => present(item.name) && item.path.startsWith("/"));
  if (listed.length === 0) return null;
  return {
    "@type": "ItemList",
    numberOfItems: listed.length,
    itemListElement: listed.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name.trim(),
      url: pageUrl(ctx, item.path),
    })),
  } as JsonLdNode;
}

export interface PersonInput {
  name: string;
  /** Path of the person's page on this site. */
  path: string;
  /** Their role as the page shows it, for example "Founder". */
  jobTitle?: string | undefined;
  /** Verified profile links the page shows (LinkedIn). */
  sameAs?: readonly string[] | undefined;
}

/** A Person who works for the Organization. Only what the page shows (integrity rule). */
export function personNode(input: PersonInput, ctx: JsonLdContext): JsonLdNode {
  const sameAs = (input.sameAs ?? []).filter((url) => /^https:\/\//.test(url));
  return compact({
    "@type": "Person",
    "@id": `${pageUrl(ctx, input.path)}#person`,
    name: input.name.trim(),
    url: pageUrl(ctx, input.path),
    jobTitle: present(input.jobTitle),
    worksFor: { "@id": organizationId(ctx) },
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  });
}

export function webPageNode(input: WebPageInput, ctx: JsonLdContext): JsonLdNode {
  const faq = (input.faq ?? []).filter((item) => present(item.question) && present(item.answer));
  const type = input.type ?? "WebPage";
  return compact({
    "@type": faq.length > 0 ? [type, "FAQPage"] : type,
    "@id": webPageId(ctx, input.path),
    url: pageUrl(ctx, input.path),
    name: input.name,
    description: present(input.description),
    isPartOf: { "@id": websiteId(ctx) },
    inLanguage: seoSite.language,
    breadcrumb: input.breadcrumb ? { "@id": breadcrumbId(ctx, input.path) } : undefined,
    about: input.aboutService ? { "@id": serviceId(ctx, input.path) } : undefined,
    dateModified: validDate(input.dateModified),
    mainEntity:
      faq.length > 0
        ? faq.map((item) => ({
            "@type": "Question",
            name: item.question.trim(),
            acceptedAnswer: { "@type": "Answer", text: item.answer.trim() },
          }))
        : (input.mainEntity ?? (input.items ? itemListNode(input.items, ctx) : null) ?? undefined),
  });
}

export interface ServiceInput {
  path: string;
  /** The page's h1, for example "Vitalos Engineering" or "Engineering Rescue". */
  name: string;
  /** Visible summary or proposition. */
  description?: string | undefined;
  /** The kind of service, in the page's own words (the practice, solution or offer name). */
  serviceType: string;
}

/** Service. No offers or prices: pricing is proposal-led (Offers page), so none is invented. */
export function serviceNode(input: ServiceInput, ctx: JsonLdContext): JsonLdNode {
  return compact({
    "@type": "Service",
    "@id": serviceId(ctx, input.path),
    name: input.name,
    description: present(input.description),
    serviceType: input.serviceType,
    url: pageUrl(ctx, input.path),
    provider: { "@id": organizationId(ctx) },
    areaServed: { "@type": "Country", name: "United Kingdom" },
  });
}

/** One `<script>` worth of nodes: a single `@context` and `@graph`, nulls dropped. */
export function jsonLdGraph(nodes: readonly (JsonLdNode | null | undefined)[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": nodes
      .filter((node): node is JsonLdNode => node !== null && node !== undefined)
      .map((node) => {
        const member: Record<string, unknown> = { ...node };
        delete member["@context"];
        return member;
      }),
  } as unknown as JsonLdNode;
}

/** The homepage's WebPage: the site's own page, linked to the WebSite and Organization. */
export function homePageNode(
  input: { name: string; description?: string | undefined },
  ctx: JsonLdContext,
): JsonLdNode {
  return {
    ...webPageNode({ path: routes.home(), name: input.name, description: input.description }, ctx),
    about: { "@id": organizationId(ctx) },
  };
}

function compact(value: Record<string, unknown>): JsonLdNode {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== null),
  ) as JsonLdNode;
}
