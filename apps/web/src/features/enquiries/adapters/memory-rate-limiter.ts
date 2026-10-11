import type { Clock, RateLimitDecision, RateLimiter } from "../domain/ports";
import { systemClock } from "../domain/ports";

/** Fixed-window limiter in process memory; same semantics as `rate_limit_consume`. */
export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { windowStart: number; hits: number }>();

  constructor(private readonly clock: Clock = systemClock) {}

  /** Clears all counters (tests). */
  reset(): void {
    this.buckets.clear();
  }

  consume(key: string, opts: { windowSeconds: number; max: number }): Promise<RateLimitDecision> {
    const nowMs = this.clock.now().getTime();
    const windowMs = opts.windowSeconds * 1000;
    const windowStart = Math.floor(nowMs / windowMs) * windowMs;
    const bucketKey = `${key}@${windowStart}`;
    const bucket = this.buckets.get(bucketKey) ?? { windowStart, hits: 0 };
    bucket.hits += 1;
    this.buckets.set(bucketKey, bucket);

    // Drop expired windows so a long-running dev server does not grow without bound.
    for (const [candidate, value] of this.buckets) {
      if (value.windowStart + windowMs < nowMs - 86_400_000) this.buckets.delete(candidate);
    }

    if (bucket.hits <= opts.max) return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
    return Promise.resolve({
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000)),
    });
  }
}
