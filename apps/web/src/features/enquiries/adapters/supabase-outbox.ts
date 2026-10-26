import { z } from "zod";
import { ENQUIRY_RECEIVED_V1, outboxKinds } from "../domain/events";
import type { OutboxItem, OutboxStore } from "../domain/ports";
import { callRpc, EnquiryStoreError } from "./supabase-rpc";
import type { RpcClient } from "./supabase-rpc";

const nullToUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === null ? undefined : value), schema.optional());

const claimedItem = z.object({
  id: z.uuid(),
  kind: z.enum(outboxKinds),
  attempts: z.number().int().min(1),
  correlationId: nullToUndefined(z.string()),
  event: z.object({
    eventId: z.string(),
    eventType: z.literal(ENQUIRY_RECEIVED_V1),
    eventVersion: z.number(),
    occurredAt: z.string(),
    producer: z.string(),
    correlationId: z.string().nullish(),
    causationId: z.string().nullish(),
    payload: z.object({
      enquiryId: z.string(),
      reference: z.string(),
      intent: z.string().nullish(),
      offerSlug: z.string().nullish(),
      sourcePath: z.string().nullish(),
    }),
  }),
  enquiry: z.object({
    id: z.string(),
    reference: z.string(),
    name: z.string(),
    organisation: nullToUndefined(z.string()),
    workEmail: z.string(),
    role: nullToUndefined(z.string()),
    goal: z.string(),
    timeframe: nullToUndefined(z.string()),
    budgetRange: nullToUndefined(z.string()),
    intent: nullToUndefined(z.string()),
    offerSlug: nullToUndefined(z.string()),
    sourcePath: nullToUndefined(z.string()),
    receivedAt: z.string(),
    // Stored as validated by the application (20261025090000); only shown, never acted on.
    details: nullToUndefined(
      z.object({
        tags: z.array(z.string()).optional(),
        healthcare: z
          .object({
            organisationType: z.string().optional(),
            sites: z.number().optional(),
            needs: z.array(z.string()).optional(),
            systems: z.string().optional(),
          })
          .optional(),
      }),
    ),
  }),
});

/** Outbox persistence over `claim_outbox_batch` / `mark_outbox` (FOR UPDATE SKIP LOCKED). */
export class SupabaseOutboxStore implements OutboxStore {
  constructor(private readonly client: RpcClient) {}

  async claimBatch(limit: number): Promise<OutboxItem[]> {
    const data = await callRpc(this.client, "claim_outbox_batch", { p_limit: limit });
    const parsed = z.array(claimedItem).safeParse(data);
    if (!parsed.success) throw new EnquiryStoreError("unexpected-result");
    return parsed.data as OutboxItem[];
  }

  async markSent(id: string, attempts: number): Promise<void> {
    await this.mark(id, attempts, "sent", null, 0);
  }

  async scheduleRetry(
    id: string,
    attempts: number,
    delaySeconds: number,
    errorCode: string,
  ): Promise<void> {
    await this.mark(id, attempts, "pending", errorCode, delaySeconds);
  }

  async markFailed(id: string, attempts: number, errorCode: string): Promise<void> {
    await this.mark(id, attempts, "failed", errorCode, 0);
  }

  private async mark(
    id: string,
    attempts: number,
    state: "sent" | "pending" | "failed",
    error: string | null,
    retryInSeconds: number,
  ): Promise<void> {
    await callRpc(this.client, "mark_outbox", {
      p_id: id,
      p_attempts: attempts,
      p_state: state,
      p_error: error,
      p_retry_in_seconds: Math.max(0, Math.round(retryInSeconds)),
    });
  }
}
