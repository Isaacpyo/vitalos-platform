import type { ContentReaders, ReadResult } from "../readers";
import { CAREERS_BASE, INSIGHTS_BASE } from "../routes";

/**
 * What a public Insights or Careers path is, decided with the SAME cached readers the pages use
 * (ADR-036), so a page that is cached implies "ok" and the proxy can set the statuses a page
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
  | { kind: "careers-index" }
  | { kind: "careers-role"; slug: string };

const SLUG = "([a-z0-9]+(?:-[a-z0-9]+)*)";
const patterns: [RegExp, (match: RegExpExecArray) => Route][] = [
  [/^\/insights$/, () => ({ kind: "insights-index" })],
  [/^\/insights\/page\/([1-9][0-9]{0,3})$/, (m) => ({ kind: "insights-page", page: Number(m[1]) })],
  [/^\/insights\/feed\.xml$/, () => ({ kind: "insights-feed" })],
  [new RegExp(`^/insights/authors/${SLUG}$`), (m) => ({ kind: "insights-author", slug: m[1]! })],
  [new RegExp(`^/insights/topics/${SLUG}$`), (m) => ({ kind: "insights-topic", slug: m[1]! })],
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

export async function lookupVerdict(path: string, readers: ContentReaders): Promise<Verdict> {
  const route = matchContentRoute(path);
  if (!route || !readers.configured) return missing;
  try {
    const state = await readers.siteState();
    const section = route.kind.startsWith("insights") ? "insights" : "careers";
    if (section === "insights" && !state.insightsOpen) return missing;
    if (section === "careers" && !state.careersOpen) return missing;

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
      case "careers-index":
        return fromResult(await readers.careersPage());
      case "careers-role":
        return fromResult(await readers.role(route.slug), redirectOf(CAREERS_BASE));
    }
  } catch {
    return { verdict: "unavailable" };
  }
}
