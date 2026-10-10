import type { NextConfig } from "next";

type RedirectRules = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>;

/**
 * Static redirects for `next.config.ts`. Stub owned by workstream G1, which derives these from
 * the version-controlled redirect map (no chains, no blanket redirects to "/"). See ADR-018.
 */
export function nextRedirects(): RedirectRules {
  return [];
}
