/**
 * The header variant the server under test was built with (ADR-045). The server reads
 * `NEXT_PUBLIC_NAV_VARIANT`; Playwright passes the runner's environment to it, so the same value
 * here says which header the pages have. Unset: `current` (local and production).
 */
export const navVariant = process.env.NEXT_PUBLIC_NAV_VARIANT === "ia" ? "ia" : "current";
export const isIaRun = navVariant === "ia";
export const CURRENT_NAV_ONLY =
  "asserts the current (ADR-031) header; the ia run has nav-ia.spec.ts";
