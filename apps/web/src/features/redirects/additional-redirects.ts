import type { RedirectRule } from "./types";

/**
 * Redirects added after the seed in `redirect-map.ts`. Edit this list in a pull request to add a
 * redirect (301 or 308 with a destination) or retire a path (410). Exact paths only; the unit
 * tests in `redirects.test.ts` validate this list together with the seed (no chains, loops or
 * shadowed live routes).
 *
 * - `/blog` → `/insights`: approved in the Insights brief (section 5.5, 15 October 2026). Paths
 *   below `/blog` move with it through `sectionMoves` in `next-redirects.ts`.
 */
export const additionalRedirects: readonly RedirectRule[] = [
  { source: "/blog", destination: "/insights", status: 308 },
];
