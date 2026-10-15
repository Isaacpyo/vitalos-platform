import { randomUUID } from "node:crypto";
import { clientIpFromHeaders, rateLimitKey } from "@vitalos/security/rate-limit";
import type { RateLimitDecision, RateLimiter } from "@vitalos/security/rate-limit";
import { correlationIdFrom, readBodyWithLimit } from "../../enquiries/http/request-guards";

/**
 * Shared guards for the content routes. Framework-free: they take `Headers` and `Request`, so the
 * handlers are unit-tested without Next.js. Every response is `no-store` and carries the
 * correlation id; error bodies are the contract's `{ error }` and never echo input.
 */

export { correlationIdFrom, readBodyWithLimit };

export const json = (
  body: unknown,
  status: number,
  correlationId: string,
  extra: Record<string, string> = {},
): Response =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-request-id": correlationId, ...extra },
  });

/**
 * Fixed-window limiter in this instance's memory (the `RateLimiter` port of `@vitalos/security`).
 * The content routes never touch the website's database (owner amendment A1), so the limits are
 * per instance: a ceiling against abuse, on top of the signatures that every route requires.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { windowStart: number; hits: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(key: string, opts: { windowSeconds: number; max: number }): Promise<RateLimitDecision> {
    const nowMs = this.now();
    const windowMs = opts.windowSeconds * 1000;
    const windowStart = Math.floor(nowMs / windowMs) * windowMs;
    const bucket = this.buckets.get(key);
    const current =
      bucket && bucket.windowStart === windowStart ? bucket : { windowStart, hits: 0 };
    current.hits += 1;
    this.buckets.set(key, current);
    if (this.buckets.size > 10_000) {
      for (const [candidate, value] of this.buckets) {
        if (value.windowStart < windowStart) this.buckets.delete(candidate);
      }
    }
    if (current.hits <= opts.max) return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
    return Promise.resolve({
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000)),
    });
  }

  reset(): void {
    this.buckets.clear();
  }
}

/** Per-route budgets, per client IP and per instance. */
export const rateLimits = {
  revalidate: { windowSeconds: 60, max: 120 },
  render: { windowSeconds: 60, max: 60 },
  preview: { windowSeconds: 60, max: 30 },
  lookup: { windowSeconds: 60, max: 1200 },
  tick: { windowSeconds: 60, max: 30 },
  // Brief section 9: per IP, 5 CV uploads and 3 applications an hour.
  "careers-upload": { windowSeconds: 3600, max: 5 },
  "careers-application": { windowSeconds: 3600, max: 3 },
} as const;

export type RateLimitScope = keyof typeof rateLimits;

// Limiter keys hold a salted hash, never the address. The salt only needs to live as long as
// the in-memory counters, so it is random per process.
const processSalt = randomUUID();

/** Consumes one request from the caller's budget; a 429 response when it is spent. */
export async function rateLimited(
  limiter: RateLimiter,
  headers: Headers,
  scope: RateLimitScope,
  correlationId: string,
  body: unknown = { error: "rate_limited" },
): Promise<Response | null> {
  const key = await rateLimitKey(
    `content:${scope}`,
    clientIpFromHeaders(headers) ?? "unknown",
    processSalt,
  );
  const decision = await limiter.consume(key, rateLimits[scope]);
  if (decision.allowed) return null;
  return json(body, 429, correlationId, {
    "retry-after": String(decision.retryAfterSeconds),
  });
}

/** `rateLimited` with the endpoint's own refusal body (the careers routes use `{ errors }`). */
export const rateLimitedFor = rateLimited;
