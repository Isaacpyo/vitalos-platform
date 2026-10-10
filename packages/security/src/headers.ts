/**
 * Security response headers (ADR-020).
 *
 * - `X-Robots-Tag: noindex, nofollow` on EVERY deploy env except `production`. The check is
 *   inverted on purpose: an unknown or mistyped env fails closed (noindex), only the literal
 *   string "production" is indexable.
 * - HSTS only when explicitly enabled (ENABLE_HSTS) after domain validation; never emitted for
 *   the `local` env so a developer's localhost is not pinned to https.
 * - CSP comes from `buildCsp` and is passed in, so this module stays free of policy details.
 */
export type SecurityDeployEnv = "local" | "preview" | "staging" | "production";

export interface SecurityHeader {
  key: string;
  value: string;
}

export interface BuildSecurityHeadersInput {
  deployEnv: SecurityDeployEnv;
  enableHsts: boolean;
  /** Enforced Content-Security-Policy value from `buildCsp`, when enabled. */
  csp?: string;
  /** Report-only (strict) policy from `buildCsp({ variant: "strict" })`, when enabled. */
  cspReportOnly?: string;
}

export const ROBOTS_NOINDEX = "noindex, nofollow";
/** One year. No `includeSubDomains` or `preload`: those are separate, irreversible decisions. */
export const HSTS_VALUE = "max-age=31536000";
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "bluetooth=()",
  "browsing-topics=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "serial=()",
  "usb=()",
].join(", ");

export const isIndexableEnv = (deployEnv: string): boolean => deployEnv === "production";

export function buildSecurityHeaders(input: BuildSecurityHeadersInput): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];

  if (input.csp) headers.push({ key: "Content-Security-Policy", value: input.csp });
  if (input.cspReportOnly) {
    headers.push({ key: "Content-Security-Policy-Report-Only", value: input.cspReportOnly });
  }
  if (input.enableHsts && input.deployEnv !== "local") {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_VALUE });
  }
  if (!isIndexableEnv(input.deployEnv)) {
    headers.push({ key: "X-Robots-Tag", value: ROBOTS_NOINDEX });
  }
  return headers;
}
