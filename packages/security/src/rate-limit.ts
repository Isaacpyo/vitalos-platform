/**
 * Rate-limit contract and key hashing. The Postgres-backed limiter lives in the web app
 * (adapters); this module holds the port plus the helpers that keep personal data out of
 * limiter keys and logs.
 */
export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds the caller should wait before retrying; meaningful when `allowed` is false. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, opts: { windowSeconds: number; max: number }): Promise<RateLimitDecision>;
}

const encoder = new TextEncoder();

/** Hex-encoded HMAC-SHA-256 of `value` under `salt`. Deterministic, not reversible without the salt. */
export async function saltedHash(value: string, salt: string): Promise<string> {
  if (salt.length === 0) throw new Error("saltedHash requires a non-empty salt");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Builds a limiter key such as `enquiry:ip:<hash>`. The identifier (an IP address, an email) is
 * hashed first, so neither the limiter table nor any log line ever holds the raw value.
 */
export async function rateLimitKey(
  scope: string,
  identifier: string,
  salt: string,
): Promise<string> {
  if (!/^[a-z0-9:_-]{1,40}$/.test(scope)) throw new Error("Invalid rate-limit scope");
  return `${scope}:${await saltedHash(`${scope}\u0000${identifier}`, salt)}`;
}

/** First hop of an `X-Forwarded-For` value, or undefined when it is missing or not an address. */
export function clientIpFromForwardedFor(value: string | null | undefined): string | undefined {
  const first = value?.split(",")[0]?.trim();
  if (!first || first.length > 45) return undefined;
  // IPv4, IPv6 or IPv4-mapped characters only. Anything else is not trusted as an identifier.
  return /^[0-9a-fA-F:.]+$/.test(first) ? first : undefined;
}

/**
 * Best-effort client address from request headers, in order of trust:
 * `x-vercel-forwarded-for` (set by Vercel's edge, not client-controllable), `x-real-ip`, then the
 * first hop of `x-forwarded-for`. A malformed candidate is skipped, not fatal: the next header is
 * tried. Returns undefined when none is usable.
 *
 * DEPLOYMENT ASSUMPTION: the app runs behind Vercel, which overwrites these headers at the edge.
 * Anywhere else (no trusted proxy) they are client-controlled, so a limiter keyed on this value
 * can be evaded by spoofing. The global limiter, Turnstile and the idempotency key still apply.
 */
export function clientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string | undefined {
  return (
    clientIpFromForwardedFor(headers.get("x-vercel-forwarded-for")) ??
    clientIpFromForwardedFor(headers.get("x-real-ip")) ??
    clientIpFromForwardedFor(headers.get("x-forwarded-for"))
  );
}
