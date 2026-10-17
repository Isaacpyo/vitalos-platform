import { z } from "zod";

/**
 * JSON-LD validation (docs/seo/DECISIONS.md 22): schema.org shape per type (zod) plus rules for
 * the whole page. Used by the unit tests and by `pnpm seo:check` on every crawled page, so it
 * imports nothing but zod (Node loads it directly from the crawler).
 *
 * Page rules:
 *  - every block has `@context: https://schema.org`;
 *  - every node has an allowed `@type`; Review, AggregateRating, HowTo, LocalBusiness and
 *    SearchAction never appear (integrity rule; the sitelinks search box is retired);
 *  - `@id`s are unique on the page, and an `{ "@id" }` reference resolves on the page unless it is
 *    a site-level node (`/#organization`, `/#website`, described on the homepage);
 *  - URLs are absolute and on the canonical origin (images may be https elsewhere);
 *  - the WebPage's `url` is the page's canonical, and its `name` is the visible h1;
 *  - every FAQ question is visible on the page.
 */

const allowedTypes = new Set([
  "Organization",
  "WebSite",
  "WebPage",
  "CollectionPage",
  "AboutPage",
  "ContactPage",
  "FAQPage",
  "ProfilePage",
  "BreadcrumbList",
  // CollectionPage mainEntity: the items an index page lists (C11).
  "ItemList",
  "ListItem",
  "Service",
  "Country",
  "PropertyValue",
  "ImageObject",
  "Question",
  "Answer",
  "Article",
  "BlogPosting",
  "Person",
  "JobPosting",
  "Place",
  "PostalAddress",
  // JobPosting baseSalary, only when the role shows its salary (Careers, ADR-039).
  "MonetaryAmount",
  "QuantitativeValue",
]);
const forbiddenTypes = new Set([
  "Review",
  "AggregateRating",
  "HowTo",
  "LocalBusiness",
  "SearchAction",
  "Offer",
]);

const url = z.url({ protocol: /^https?$/ });
const ref = z.object({ "@id": z.string().min(1) }).strict();
const text = z.string().trim().min(1);

const typeSchemas: Record<string, z.ZodType> = {
  Organization: z.looseObject({ name: text, url }),
  WebSite: z.looseObject({ name: text, url }),
  WebPage: z.looseObject({ "@id": text, url, name: text, isPartOf: ref }),
  BreadcrumbList: z.looseObject({
    itemListElement: z
      .array(
        z.looseObject({
          "@type": z.literal("ListItem"),
          position: z.number().int().positive(),
          name: text,
          item: url,
        }),
      )
      .min(2)
      .refine((items) => items.every((item, index) => item.position === index + 1), {
        message: "positions must run 1, 2, 3…",
      }),
  }),
  ItemList: z.looseObject({
    itemListElement: z
      .array(
        z.looseObject({
          "@type": z.literal("ListItem"),
          position: z.number().int().positive(),
          name: text,
          url,
        }),
      )
      .min(1)
      .refine((items) => items.every((item, index) => item.position === index + 1), {
        message: "positions must run 1, 2, 3…",
      }),
  }),
  Person: z.looseObject({ name: text }),
  Service: z.looseObject({ name: text, serviceType: text, provider: ref, url }),
  FAQPage: z.looseObject({
    mainEntity: z
      .array(
        z.looseObject({
          "@type": z.literal("Question"),
          name: text,
          acceptedAnswer: z.looseObject({ "@type": z.literal("Answer"), text }),
        }),
      )
      .min(1),
  }),
  Article: z.looseObject({
    headline: text,
    datePublished: text,
    author: z.array(z.unknown()).min(1),
  }),
  BlogPosting: z.looseObject({
    headline: text,
    datePublished: text,
    author: z.array(z.unknown()).min(1),
  }),
  JobPosting: z.looseObject({
    title: text,
    description: text,
    datePosted: text,
    hiringOrganization: z.unknown(),
  }),
};

const pageTypes = new Set(["WebPage", "CollectionPage", "AboutPage", "ContactPage", "ProfilePage"]);

export interface JsonLdPageContext {
  /** Canonical origin, for example `https://vitalos.co.uk`. */
  origin: string;
  /** The page's canonical URL. */
  canonical?: string | undefined;
  /** Text of the page's h1. */
  h1?: string | undefined;
  /** All visible text of the page, whitespace-normalised. */
  text?: string | undefined;
}

type Node = Record<string, unknown>;

const typesOf = (node: Node): string[] =>
  [node["@type"]].flat().filter((t) => typeof t === "string");
const norm = (value: string) => value.replace(/\s+/g, " ").trim();
/** A root URL with or without its trailing slash is the same page. */
const sameUrl = (a: string, b: string) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

/** Every node in the blocks: top-level nodes, `@graph` members and nested typed objects. */
function collect(blocks: readonly unknown[]): { top: Node[]; all: Node[] } {
  const top: Node[] = [];
  const all: Node[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const node = value as Node;
    if (node["@type"] !== undefined) all.push(node);
    for (const [key, child] of Object.entries(node)) if (key !== "@context") visit(child);
  };
  for (const block of blocks) {
    const members = Array.isArray(block)
      ? block
      : block && typeof block === "object" && "@graph" in block
        ? ((block as Node)["@graph"] as unknown[])
        : [block];
    top.push(...(members.filter((m) => m && typeof m === "object") as Node[]));
    visit(block);
  }
  return { top, all };
}

/** Problems with one page's JSON-LD blocks; empty when valid. */
export function validateJsonLd(blocks: readonly unknown[], page: JsonLdPageContext): string[] {
  const issues: string[] = [];
  const contexts = blocks.map((block) =>
    Array.isArray(block)
      ? block.map((b) => (b as Node)?.["@context"])
      : [(block as Node)?.["@context"]],
  );
  if (contexts.flat().some((c) => c !== "https://schema.org")) {
    issues.push('every block needs "@context": "https://schema.org"');
  }

  const { top, all } = collect(blocks);
  const ids = new Map<string, number>();
  for (const node of top) {
    const id = node["@id"];
    if (typeof id === "string") ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  for (const [id, count] of ids) if (count > 1) issues.push(`@id ${id} is used ${count} times`);

  const siteIds = new Set([`${page.origin}/#organization`, `${page.origin}/#website`]);
  const visitRefs = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visitRefs);
    if (!value || typeof value !== "object") return;
    const node = value as Node;
    const keys = Object.keys(node);
    if (keys.length === 1 && keys[0] === "@id") {
      const id = String(node["@id"]);
      if (!ids.has(id) && !siteIds.has(id)) issues.push(`reference ${id} does not resolve`);
      return;
    }
    for (const child of Object.values(node)) visitRefs(child);
  };
  top.forEach((node) => Object.values(node).forEach(visitRefs));

  for (const node of all) {
    const types = typesOf(node);
    if (types.length === 0) issues.push("a node has no @type");
    for (const type of types) {
      if (forbiddenTypes.has(type)) issues.push(`${type} is not allowed`);
      else if (!allowedTypes.has(type)) issues.push(`${type} is not an expected type`);
      const schema = typeSchemas[pageTypes.has(type) ? "WebPage" : type];
      const parsed = schema?.safeParse(node);
      if (parsed && !parsed.success) {
        issues.push(
          `${type}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(node)"} ${i.message}`).join("; ")}`,
        );
      }
    }
    if (typesOf(node).includes("WebSite") && "potentialAction" in node) {
      issues.push("WebSite must not have potentialAction (sitelinks search box is retired)");
    }
  }

  // URLs on the canonical origin (images may live on another https host).
  const urlKeys = new Set(["url", "item", "@id", "mainEntityOfPage"]);
  const visitUrls = (value: unknown, key = "") => {
    if (Array.isArray(value)) return value.forEach((v) => visitUrls(v, key));
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Node)) {
        if (k === "sameAs" || k === "logo" || k === "image") continue;
        visitUrls(v, k);
      }
      return;
    }
    if (typeof value === "string" && urlKeys.has(key) && !value.startsWith(`${page.origin}/`)) {
      issues.push(`${key} ${value} is not on ${page.origin}`);
    }
  };
  top.forEach((node) => visitUrls(node));

  const webPage = top.find((node) => typesOf(node).some((type) => pageTypes.has(type)));
  if (webPage) {
    if (page.canonical && !sameUrl(String(webPage["url"]), page.canonical)) {
      issues.push(`WebPage url ${String(webPage["url"])} is not the canonical ${page.canonical}`);
    }
    if (page.h1 !== undefined && norm(String(webPage["name"] ?? "")) !== norm(page.h1)) {
      issues.push(`WebPage name "${String(webPage["name"])}" is not the h1 "${page.h1}"`);
    }
  }
  if (page.text !== undefined) {
    const visible = norm(page.text);
    for (const node of all.filter((n) => typesOf(n).includes("Question"))) {
      const question = norm(String(node["name"] ?? ""));
      if (question && !visible.includes(question))
        issues.push(`FAQ question not visible: ${question}`);
    }
  }
  return issues;
}
