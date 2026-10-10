/**
 * Content-Security-Policy builder (ADR-020).
 *
 * Header-based (not nonce-based): a per-request nonce would force every page to render
 * dynamically and defeat static rendering and CDN caching, so the enforced policy keeps
 * `'unsafe-inline'` for scripts (Next.js emits inline bootstrap/flight scripts). A stricter
 * `strict` variant without `'unsafe-inline'` is built for `Content-Security-Policy-Report-Only`
 * so violations are observable before the enforced policy is tightened.
 *
 * Pure function: no environment access. `apps/web/src/config/security-headers.ts` decides the
 * inputs per deploy environment.
 */
export interface BuildCspInput {
  /** Next.js development server: React needs `'unsafe-eval'` for debugging tooling. */
  isDev: boolean;
  /** Allow Cloudflare Turnstile (script and frame). Only when both keys are configured. */
  turnstile: boolean;
  /** Sanity project id; required for the Sanity API origins below. */
  sanityProjectId?: string;
  /**
   * Allow browser connections to the Sanity API (draft/preview and visual editing). Off by
   * default so the public production policy never trusts client-side Sanity calls.
   */
  sanityApiConnect?: boolean;
  /** Origins allowed to frame the site. Empty means `'none'`. */
  frameAncestors?: readonly string[];
  /** `enforced` (default) keeps `'unsafe-inline'` scripts; `strict` drops it (report-only). */
  variant?: "enforced" | "strict";
  /** Emit `upgrade-insecure-requests` (not for plain-http local runs). */
  upgradeInsecureRequests?: boolean;
}

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const SANITY_CDN_ORIGIN = "https://cdn.sanity.io";

const originPattern = /^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;
const projectIdPattern = /^[a-z0-9-]+$/;

/** Throws on anything that is not a bare http(s) origin: CSP values must never carry `;` or spaces. */
export function assertCspOrigin(value: string): string {
  if (!originPattern.test(value)) {
    throw new Error("Invalid CSP origin: expected a bare http(s) origin without path or spaces");
  }
  return value;
}

/** Sanity API hosts for a project: query API, API CDN and the live-content websocket. */
export function sanityApiOrigins(projectId: string): string[] {
  if (!projectIdPattern.test(projectId)) {
    throw new Error("Invalid Sanity project id for CSP");
  }
  return [
    `https://${projectId}.api.sanity.io`,
    `https://${projectId}.apicdn.sanity.io`,
    `wss://${projectId}.api.sanity.io`,
  ];
}

export function buildCsp(input: BuildCspInput): string {
  const strict = input.variant === "strict";

  const scriptSrc = ["'self'"];
  if (!strict) scriptSrc.push("'unsafe-inline'");
  if (input.isDev) scriptSrc.push("'unsafe-eval'");
  if (input.turnstile) scriptSrc.push(TURNSTILE_ORIGIN);

  const connectSrc = ["'self'"];
  if (input.sanityApiConnect && input.sanityProjectId) {
    connectSrc.push(...sanityApiOrigins(input.sanityProjectId));
  }

  const frameAncestors = (input.frameAncestors ?? []).map(assertCspOrigin);

  const directives: Array<[string, readonly string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    // styled-components and React style attributes need inline styles; styles carry no script
    // execution risk once script-src is locked down.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", SANITY_CDN_ORIGIN]],
    ["font-src", ["'self'"]],
    ["connect-src", connectSrc],
    ["frame-src", input.turnstile ? [TURNSTILE_ORIGIN] : ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", frameAncestors.length > 0 ? frameAncestors : ["'none'"]],
  ];

  const parts = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  if (input.upgradeInsecureRequests) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
