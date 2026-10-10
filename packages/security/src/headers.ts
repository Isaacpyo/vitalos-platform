/**
 * Security response headers. Contract only: the implementation (Referrer-Policy, nosniff,
 * Permissions-Policy, opt-in HSTS and `X-Robots-Tag: noindex, nofollow` for every
 * non-production deploy env) is owned by workstream E and documented in ADR-020.
 */
export type SecurityDeployEnv = "local" | "preview" | "staging" | "production";

export interface SecurityHeader {
  key: string;
  value: string;
}

export interface BuildSecurityHeadersInput {
  deployEnv: SecurityDeployEnv;
  enableHsts: boolean;
  /** Content-Security-Policy value from `buildCsp`, when enabled. */
  csp?: string;
}

/** Stub: returns no headers until workstream E implements it. */
export function buildSecurityHeaders(input: BuildSecurityHeadersInput): SecurityHeader[] {
  void input;
  return [];
}
