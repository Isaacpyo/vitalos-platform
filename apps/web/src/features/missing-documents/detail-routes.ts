import type { DocKind } from "@vitalos/cms";

/**
 * The dynamic detail routes whose page answers `notFound()` when the document does not exist, and
 * how each one is addressed in `ContentSource.listParams` (ADR-027). Pure and framework-free.
 *
 * `fields` names the route parameters (in `listParams` terms) that identify the document;
 * `values` holds what the request supplied for them.
 */
export interface DetailRoute {
  kind: DocKind;
  fields: readonly string[];
  values: readonly string[];
}

type Families = Record<string, { kind: DocKind; fields: readonly string[] }[]>;

/**
 * First path segment to the document kind and the `listParams` keys of the remaining segments.
 * Insights and Careers are not here: they come from the Super Admin and the proxy asks the
 * content lookup about them (ADR-035, ADR-036).
 */
export const families: Families = {
  "what-we-do": [{ kind: "practice", fields: ["slug"] }],
  solutions: [{ kind: "solution", fields: ["slug"] }],
  offers: [{ kind: "offer", fields: ["slug"] }],
  industries: [{ kind: "industry", fields: ["slug"] }],
  work: [{ kind: "caseStudy", fields: ["slug"] }],
  people: [{ kind: "person", fields: ["slug"] }],
  legal: [{ kind: "legalPage", fields: ["slug"] }],
  trust: [{ kind: "trustItem", fields: ["topic"] }],
  labs: [
    { kind: "labAsset", fields: ["type"] },
    { kind: "labAsset", fields: ["type", "slug"] },
  ],
};

/**
 * TRANSITIONAL: roles from `@vitalos/cms`, checked only while the content API is not configured
 * (the Careers pages still render from the CMS until Phase 4 moves them to the admin). Delete
 * with those pages. Insights is served only from the admin (Phase 3).
 */
export const legacyContentFamilies: Families = {
  careers: [{ kind: "job", fields: ["slug"] }],
};

/**
 * Which detail route, if any, a request path addresses. `null` for every other path (index pages,
 * static pages, API routes, assets), which the caller must leave alone. A trailing slash is
 * ignored; a malformed percent-escape returns `null` so the page itself decides.
 */
export function matchDetailRoute(pathname: string, table: Families = families): DetailRoute | null {
  const segments = pathname.split("/").filter((segment, index) => segment !== "" || index === 0);
  // ["", "solutions", "slug"]: the leading empty segment comes from the first slash.
  const parts = segments.slice(1);
  const [first, ...rest] = parts;
  if (first === undefined || rest.length === 0 || rest.some((part) => part === "")) return null;
  const candidates = Object.hasOwn(table, first) ? table[first] : undefined;
  if (!candidates) return null;
  const family = candidates.find((candidate) => candidate.fields.length === rest.length);
  if (!family) return null;
  try {
    return { kind: family.kind, fields: family.fields, values: rest.map(decodeURIComponent) };
  } catch {
    return null;
  }
}

/** Key under which a document (or a lab type) is recorded in the index. */
export function routeKey(fields: readonly string[], values: readonly string[]): string {
  return fields.map((field, index) => `${field}=${values[index] ?? ""}`).join("&");
}
