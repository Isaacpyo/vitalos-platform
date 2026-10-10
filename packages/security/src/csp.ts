/**
 * Content-Security-Policy builder. Contract only: the full policy (Turnstile, Sanity,
 * frame-ancestors for Studio outside production, strict report-only variant) is owned by
 * workstream E and documented in ADR-020.
 */
export interface BuildCspInput {
  isDev: boolean;
  turnstile: boolean;
  sanityProjectId?: string;
  /** Origins allowed to frame the site. Empty means `'none'`. */
  frameAncestors?: readonly string[];
}

/** Stub: a deliberately restrictive baseline until workstream E implements the real policy. */
export function buildCsp(input: BuildCspInput): string {
  void input;
  return "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
}
