import { z } from "zod";
import type { RateLimitDecision, RateLimiter } from "../domain/ports";
import { callRpc, EnquiryStoreError } from "./supabase-rpc";
import type { RpcClient } from "./supabase-rpc";

const decision = z.object({
  allowed: z.boolean(),
  retryAfterSeconds: z.number().int().min(0),
});

/** Fixed-window limiter backed by `rate_limit_consume`. Keys are already salted hashes. */
export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly client: RpcClient) {}

  async consume(
    key: string,
    opts: { windowSeconds: number; max: number },
  ): Promise<RateLimitDecision> {
    const data = await callRpc(this.client, "rate_limit_consume", {
      p_key: key,
      p_window_seconds: opts.windowSeconds,
      p_max: opts.max,
    });
    const parsed = decision.safeParse(data);
    if (!parsed.success) throw new EnquiryStoreError("unexpected-result");
    return parsed.data;
  }
}
