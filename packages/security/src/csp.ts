/**
 * Content-Security-Policy builder (ADR-020).
 *
 * Header-based (not nonce-based): a per-request nonce would force every page to render
 * dynamically and defeat static rendering and CDN caching, so the enforced policy keeps
 * `'unsafe-inline'` for script elements (Next.js emits inline bootstrap/flight scripts) and
 * forbids inline event-handler attributes (`script-src-attr 'none'`). Re-evaluated for Next.js
 * 16 in ADR-047. A stricter
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
  /** Origins allowed to frame the site. Empty means `'none'`. */
  frameAncestors?: readonly string[];
  /** `enforced` (default) keeps `'unsafe-inline'` scripts; `strict` drops it (report-only). */
  variant?: "enforced" | "strict";
  /** Emit `upgrade-insecure-requests` (not for plain-http local runs). */
  upgradeInsecureRequests?: boolean;
  /** Extra origins for `img-src` (e.g. the content media host). Bare http(s) origins only. */
  imgOrigins?: readonly string[];
  /** Extra origins for `connect-src` (e.g. the CV upload host). Bare http(s) origins only. */
  connectOrigins?: readonly string[];
  /**
   * Extra `connect-src` origins: the Relay realtime WebSocket (`wss://<project>.supabase.co`,
   * ADR-038). Bare ws(s)/http(s) origins only.
   */
  connect?: readonly string[];
}

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const originPattern = /^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;
const connectPattern = /^(wss?|https?):\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

/** Throws on anything that is not a bare ws(s)/http(s) origin (connect-src only). */
export function assertConnectOrigin(value: string): string {
  if (!connectPattern.test(value)) {
    throw new Error("Invalid CSP connect origin: expected a bare ws(s) or http(s) origin");
  }
  return value;
}

/** Throws on anything that is not a bare http(s) origin: CSP values must never carry `;` or spaces. */
export function assertCspOrigin(value: string): string {
  if (!originPattern.test(value)) {
    throw new Error("Invalid CSP origin: expected a bare http(s) origin without path or spaces");
  }
  return value;
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export function buildCsp(input: BuildCspInput): string {
  const strict = input.variant === "strict";

  const scriptSrc = ["'self'"];
  if (!strict) scriptSrc.push("'unsafe-inline'");
  if (input.isDev) scriptSrc.push("'unsafe-eval'");
  if (input.turnstile) scriptSrc.push(TURNSTILE_ORIGIN);

  const connectSrc = [
    "'self'",
    ...unique([
      ...(input.connectOrigins ?? []).map(assertCspOrigin),
      ...(input.connect ?? []).map(assertConnectOrigin),
    ]),
  ];
  const imgSrc = ["'self'", "data:", ...unique((input.imgOrigins ?? []).map(assertCspOrigin))];

  const frameAncestors = (input.frameAncestors ?? []).map(assertCspOrigin);

  const directives: Array<[string, readonly string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    // No inline event-handler attributes (`onclick="…"`), even though inline <script> elements
    // must stay allowed for Next.js's static pages (ADR-047). React never renders them.
    ["script-src-attr", ["'none'"]],
    // styled-components and React style attributes need inline styles; styles carry no script
    // execution risk once script-src is locked down.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", imgSrc],
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
