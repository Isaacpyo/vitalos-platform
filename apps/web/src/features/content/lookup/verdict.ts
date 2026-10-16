import type { ContentReaders, ReadResult } from "../readers";
import type { SlugGuard } from "./slug-guard";
import { CAREERS_BASE, INSIGHTS_BASE } from "../routes";

/**
 * What a public Insights or Careers path is, decided with the SAME cached readers the pages use
 * (ADR-040), so a page that is cached implies "ok" and the proxy can set the statuses a page
 * cannot: 308 for an old slug, a server-rendered 404, or 503 with `Retry-After`.
 *
 * - Content not configured, or the section closed: `missing`.
 * - The admin unreachable with nothing cached (a reader throws): `unavailable`.
 * Pure: the readers are injected.
 */

export type Verdict =
  | { verdict: "ok" }
  | { verdict: "missing" }
  | { verdict: "redirect"; location: string }
  | { verdict: "unavailable" };

type Route =
  | { kind: "insights-index" }
  | { kind: "insights-page"; page: number }
  | { kind: "insights-feed" }
  | { kind: "insights-post"; slug: string }
  | { kind: "insights-author"; slug: string }
  | { kind: "insights-topic"; slug: string }
  | { kind: "insights-topic-page"; slug: string; page: number }
  | { kind: "careers-index" }
  | { kind: "careers-role"; slug: string };

const SLUG = "([a-z0-9]+(?:-[a-z0-9]+)*)";
const patterns: [RegExp, (match: RegExpExecArray) => Route][] = [
  [/^\/insights$/, () => ({ kind: "insights-index" })],
  [/^\/insights\/page\/([1-9][0-9]{0,3})$/, (m) => ({ kind: "insights-page", page: Number(m[1]) })],
  [/^\/insights\/feed\.xml$/, () => ({ kind: "insights-feed" })],
  [new RegExp(`^/insights/authors/${SLUG}$`), (m) => ({ kind: "insights-author", slug: m[1]! })],
  [new RegExp(`^/insights/topics/${SLUG}$`), (m) => ({ kind: "insights-topic", slug: m[1]! })],
  [
    new RegExp(`^/insights/topics/${SLUG}/page/([1-9][0-9]{0,3})$`),
    (m) => ({ kind: "insights-topic-page", slug: m[1]!, page: Number(m[2]) }),
  ],
  [new RegExp(`^/insights/${SLUG}$`), (m) => ({ kind: "insights-post", slug: m[1]! })],
  [/^\/careers$/, () => ({ kind: "careers-index" })],
  [new RegExp(`^/careers/${SLUG}$`), (m) => ({ kind: "careers-role", slug: m[1]! })],
];

/** The lookup route for a path, or null when the path is not an Insights or Careers page. */
export function matchContentRoute(path: string): Route | null {
  if (path.length > 200) return null;
  for (const [pattern, build] of patterns) {
    const match = pattern.exec(path);
    if (match) {
      const route = build(match);
      if ("slug" in route && route.slug.length > 80) return null;
      return route;
    }
  }
  return null;
}

/** Whether the proxy should ask the lookup route about this path. */
export const isContentLookupPath = (path: string): boolean => matchContentRoute(path) !== null;

const ok: Verdict = { verdict: "ok" };
const missing: Verdict = { verdict: "missing" };

const fromResult = <T>(
  result: ReadResult<T>,
  redirect?: (data: T) => string | undefined,
): Verdict => {
  if (result.kind === "missing") return missing;
  const location = redirect?.(result.data);
  return location ? { verdict: "redirect", location } : ok;
};

const redirectOf = (base: string) => (data: unknown) =>
  typeof data === "object" &&
  data !== null &&
  "redirect" in data &&
  typeof data.redirect === "string"
    ? `${base}/${data.redirect}`
    : undefined;

/** The page a slug route belongs to, as the sitemap lists it; null for routes without a slug. */
function slugPath(route: Route): string | null {
  switch (route.kind) {
    case "insights-post":
      return `${INSIGHTS_BASE}/${route.slug}`;
    case "insights-author":
      return `${INSIGHTS_BASE}/authors/${route.slug}`;
    case "insights-topic":
    case "insights-topic-page":
      return `${INSIGHTS_BASE}/topics/${route.slug}`;
    case "careers-role":
      return `${CAREERS_BASE}/${route.slug}`;
    default:
      return null;
  }
}

/** The paths the cached sitemap lists, or null when it cannot be read (no pre-filter then). */
async function listedPaths(readers: ContentReaders): Promise<Set<string> | null> {
  try {
    const result = await readers.sitemap();
    return result.kind === "ok" ? new Set(result.data.entries.map((entry) => entry.path)) : null;
  } catch {
    return null;
  }
}

/**
 * The verdict for a path. With a `guard`, a slug the cached sitemap does not list is confirmed
 * with an admin read only within the guard's per-minute budget, and is "missing" beyond it, so
 * random slugs cannot drive the admin to its rate limit (see `slug-guard.ts`).
 */
export async function lookupVerdict(
  path: string,
  readers: ContentReaders,
  guard?: SlugGuard,
): Promise<Verdict> {
  const route = matchContentRoute(path);
  if (!route || !readers.configured) return missing;
  try {
    const state = await readers.siteState();
    const section = route.kind.startsWith("insights") ? "insights" : "careers";
    if (section === "insights" && !state.insightsOpen) return missing;
    if (section === "careers" && !state.careersOpen) return missing;

    const page = slugPath(route);
    if (guard && page && !guard.isRemembered(page)) {
      const listed = await listedPaths(readers);
      if (listed && !listed.has(page)) {
        if (!guard.allowConfirm()) return missing;
        const confirmed = await routeVerdict(route, readers);
        if (confirmed.verdict === "ok" || confirmed.verdict === "redirect") guard.remember(page);
        return confirmed;
      }
    }
    return await routeVerdict(route, readers);
  } catch {
    return { verdict: "unavailable" };
  }
}

async function routeVerdict(route: Route, readers: ContentReaders): Promise<Verdict> {
  switch (route.kind) {
    case "insights-index":
      return fromResult(await readers.listPosts({ page: 1 }));
    case "insights-page": {
      // Page 1 lives at /insights.
      if (route.page === 1) return { verdict: "redirect", location: INSIGHTS_BASE };
      const result = await readers.listPosts({ page: route.page });
      if (result.kind === "missing" || route.page > result.data.totalPages) return missing;
      return ok;
    }
    case "insights-feed":
      return fromResult(await readers.feed());
    case "insights-post":
      return fromResult(await readers.post(route.slug), redirectOf(INSIGHTS_BASE));
    case "insights-author":
      return fromResult(await readers.author(route.slug), redirectOf(`${INSIGHTS_BASE}/authors`));
    case "insights-topic":
      return fromResult(await readers.topic(route.slug, 1));
    case "insights-topic-page": {
      // Page 1 lives at the topic's own path.
      if (route.page === 1) {
        return { verdict: "redirect", location: `${INSIGHTS_BASE}/topics/${route.slug}` };
      }
      const result = await readers.topic(route.slug, route.page);
      if (result.kind === "missing" || route.page > result.data.posts.totalPages) return missing;
      return ok;
    }
    case "careers-index":
      return fromResult(await readers.careersPage());
    case "careers-role":
      return fromResult(await readers.role(route.slug), redirectOf(CAREERS_BASE));
  }
}
