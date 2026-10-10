/**
 * Rate-limit contract. Implementation (key hashing, Postgres-backed limiter) is owned by
 * workstream D.
 */
export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds the caller should wait before retrying; meaningful when `allowed` is false. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, opts: { windowSeconds: number; max: number }): Promise<RateLimitDecision>;
}
