import { routes } from "@vitalos/cms";
import type { RedirectRule } from "./types";

/**
 * Redirects added after the seed in `redirect-map.ts`. Edit this list in a pull request to add a
 * redirect (308 with a destination; 301 is accepted but not used) or retire a path (410). Exact paths only; the unit
 * tests in `redirects.test.ts` validate this list together with the seed (no chains, loops or
 * shadowed live routes).
 */
export const additionalRedirects: readonly RedirectRule[] = [
  // The Leadership page was removed (owner direction, 15 Oct 2026); its links go to About.
  { source: "/about/leadership", destination: routes.about(), status: 308 },
];
