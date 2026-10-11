/**
 * Studio Presentation (visual editing) configuration (`@vitalos/cms/presentation`).
 *
 * Locations and main-document resolvers are derived from routes.ts, the single source of public
 * URLs, so a route change cannot silently break preview.
 */
import { defineDocuments, defineLocations } from "sanity/presentation";
import type { DocumentLocationResolvers, DocumentResolver } from "sanity/presentation";
import { documentHref, type HrefSource } from "./schemaTypes/document-href";
import { routeManifest, routePageKeys, apiRoutes, hrefForRoutePage } from "./routes";

/** Local web app, used when SANITY_STUDIO_PREVIEW_URL is not set. */
export const defaultPreviewOrigin = "http://localhost:3000";

/** Presentation `previewUrl` option: initial origin plus the draft-mode enable route from apiRoutes. */
export function previewUrlOption(origin: string | undefined) {
  return {
    initial: origin && origin.length > 0 ? origin : defaultPreviewOrigin,
    previewMode: { enable: apiRoutes.draftModeEnable, disable: apiRoutes.draftModeDisable },
  };
}

/** Document types that have a public route and the fields their path depends on. */
export const locationTypes = [
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
  "routePage",
  "homePage",
] as const;

const select = {
  title: "title",
  name: "name",
  heading: "heading",
  slug: "slug.current",
  labType: "labType",
  topic: "topic",
  routeKey: "routeKey",
} as const;

type Selected = HrefSource & { title?: string; name?: string; heading?: string };

export function locationFor(type: string, value: Selected | null) {
  if (!value) return null;
  const href = documentHref(type, value);
  if (href === null) return null;
  return { locations: [{ title: value.title ?? value.name ?? value.heading ?? href, href }] };
}

export const locations: DocumentLocationResolvers = Object.fromEntries(
  locationTypes.map((type) => [
    type,
    defineLocations({
      select,
      resolve: (value: Selected | null) => locationFor(type, value),
    }),
  ]),
);

/** Next.js route patterns (`[param]`) converted to Presentation's `:param` syntax. */
export const toPresentationRoute = (pattern: string): string =>
  pattern.replace(/\[(\w+)\]/g, ":$1");

const detail = (pattern: string, type: string): DocumentResolver => {
  const param = /\[(\w+)\]$/.exec(pattern)?.[1] ?? "slug";
  return {
    route: toPresentationRoute(pattern),
    filter: `_type == "${type}" && slug.current == $slug`,
    params: ({ params }) => ({ slug: params[param] ?? "" }),
  };
};

/** Detail routes: manifest pattern -> document type. Asserted against `routeManifest` in tests. */
export const detailRoutes = {
  practice: "/what-we-do/[practice]",
  solution: "/solutions/[slug]",
  offer: "/offers/[slug]",
  industry: "/industries/[slug]",
  caseStudy: "/work/[slug]",
  insight: "/insights/[slug]",
  person: "/people/[slug]",
  job: "/careers/[slug]",
  legalPage: "/legal/[slug]",
} as const;

export const labAssetRoute = "/labs/[type]/[slug]";
export const labTypeIndexRoute = "/labs/[type]";
export const trustTopicRoute = "/trust/[topic]";

export const mainDocuments = defineDocuments([
  { route: "/", type: "homePage" },
  ...Object.entries(detailRoutes).map(([type, pattern]) => detail(pattern, type)),
  {
    route: toPresentationRoute(labAssetRoute),
    filter: '_type == "labAsset" && labType == $labType && slug.current == $slug',
    params: ({ params }) => ({ labType: params["type"] ?? "", slug: params["slug"] ?? "" }),
  },
  {
    // Lab type indexes have no document of their own; they edit the Labs route page.
    route: toPresentationRoute(labTypeIndexRoute),
    filter: '_type == "routePage" && routeKey == $routeKey',
    params: { routeKey: "labs" },
  },
  {
    route: toPresentationRoute(trustTopicRoute),
    filter: '_type == "trustItem" && topic == $topic',
    params: ({ params }) => ({ topic: params["topic"] ?? "" }),
  },
  ...routePageKeys.map((key): DocumentResolver => ({
    route: hrefForRoutePage(key),
    filter: '_type == "routePage" && routeKey == $routeKey',
    params: { routeKey: key },
  })),
]);

export const presentationResolve = { mainDocuments, locations } as const;

/** Every manifest pattern that a detail resolver above claims; used by tests to detect drift. */
export const resolvedPatterns: readonly string[] = [
  ...Object.values(detailRoutes),
  labAssetRoute,
  trustTopicRoute,
];
export const manifestPatterns: readonly string[] = routeManifest.map((entry) => entry.pattern);
