import { routes } from "@vitalos/cms";
import { additionalRedirects } from "./additional-redirects";
import type { RedirectRule } from "./types";

/**
 * The version-controlled redirect map (ADR-018). Exact-path rules only: no wildcards, no regex,
 * no query handling. `redirectMap` is the seed below plus `additionalRedirects`
 * (`additional-redirects.ts`, empty until the owner has approved further redirects).
 *
 * The seed is limited to the four redirects named in the specification (Stage 8 §7 URL
 * architecture; Stage 10 §12 legacy routes). Nothing else is invented: no blanket redirect to
 * "/", no guesses at legacy URLs. A URL inventory from the live site (blocked on the owner,
 * plan section 6) will add rules in `additional-redirects.ts`.
 */
export const seedRedirects: readonly RedirectRule[] = [
  { source: "/services", destination: routes.whatWeDo(), status: 301 },
  { source: "/technologies", destination: routes.labs(), status: 301 },
  { source: "/privacy", destination: routes.legal("privacy"), status: 301 },
  { source: "/terms", destination: routes.legal("terms"), status: 301 },
];

export const redirectMap: readonly RedirectRule[] = [...seedRedirects, ...additionalRedirects];
