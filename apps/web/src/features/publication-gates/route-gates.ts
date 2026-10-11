import { routeManifest } from "@vitalos/cms";
import type { GateKey, RoutePageKey } from "@vitalos/cms";

/**
 * Which publication gate governs a route (pure, derived from the route manifest in
 * `@vitalos/cms`, so it cannot drift from ADR-022). The gate thresholds and the open/closed
 * decisions themselves live in `@vitalos/cms` (`content/gates.ts`).
 */

/** Gate for a route-page key (the singleton behind an index page), if any. */
export function gateForRoutePage(key: RoutePageKey): GateKey | undefined {
  const entry = routeManifest.find((route) => route.pattern === `/${keyToPath(key)}`);
  return entry?.gate;
}

/** `leadership` is served at `/about/leadership`; every other key is its own path. */
function keyToPath(key: RoutePageKey): string {
  return key === "leadership" ? "about/leadership" : key;
}

const patternRegexes = routeManifest.map((entry) => ({
  entry,
  regex: new RegExp(`^${entry.pattern.replace(/\[[^\]]+\]/g, "[^/]+")}$`),
}));

/** The manifest entry a concrete path belongs to, or undefined for unknown paths. */
export function manifestEntryForPath(path: string) {
  return patternRegexes.find(({ regex }) => regex.test(path))?.entry;
}

/** Gate for a concrete path such as `/work/some-case-study`. */
export function gateForPath(path: string): GateKey | undefined {
  return manifestEntryForPath(path)?.gate;
}

const staticRoutes: ReadonlySet<string> = new Set(
  routeManifest.filter((entry) => !entry.pattern.includes("[")).map((entry) => entry.pattern),
);

/**
 * True for paths a redirect source must never shadow: the static pages in the manifest and the
 * API. Dynamic detail paths (`/insights/old-slug`) are NOT live routes here: a slug change
 * legitimately redirects the old slug. Mirrors `shadowsLiveRoute` in `@vitalos/cms`.
 */
export function isLiveStaticRoute(path: string): boolean {
  return staticRoutes.has(path) || path === "/api" || path.startsWith("/api/");
}
