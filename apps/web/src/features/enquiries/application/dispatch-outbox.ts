import { NotificationError } from "../domain/ports";
import type { EnquiryLogger, Notifier, OutboxStore } from "../domain/ports";

export interface DispatchOptions {
  /** Items claimed per run. */
  batchSize: number;
  /** Total attempts (including the first) before an item is dead-lettered. */
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
}

export const defaultDispatchOptions: DispatchOptions = {
  batchSize: 10,
  maxAttempts: 5,
  baseDelaySeconds: 60,
  maxDelaySeconds: 3600,
};

export interface DispatchSummary {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

export interface DispatchDeps {
  store: OutboxStore;
  notifier: Notifier;
  logger: EnquiryLogger;
}

/** Exponential backoff: base, 2x, 4x ... capped. `attempt` is 1 for the first failure. */
export function backoffSeconds(attempt: number, options: DispatchOptions): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(options.maxDelaySeconds, options.baseDelaySeconds * 2 ** exponent);
}

const errorCodeOf = (error: unknown): { code: string; retryable: boolean } => {
  if (error instanceof NotificationError) return { code: error.code, retryable: error.retryable };
  // Unknown errors are retried, but only the class name is recorded: messages may carry content.
  return { code: error instanceof Error ? error.name.slice(0, 60) : "unknown", retryable: true };
};

/**
 * Drains one batch of the outbox. The outbox row is the durability guarantee: an enquiry is
 * already stored when this runs, and a failure here only delays the notification.
 *
 * Delivery is at-least-once. Idempotency is per (enquiry, kind): the database holds one outbox
 * row per pair, only `processing` rows are claimed, and each message carries a stable
 * idempotency key so a provider can de-duplicate a re-delivery after a crash.
 */
export async function dispatchOutbox(
  deps: DispatchDeps,
  options: Partial<DispatchOptions> = {},
): Promise<DispatchSummary> {
  const config = { ...defaultDispatchOptions, ...options };
  const summary: DispatchSummary = { claimed: 0, sent: 0, retried: 0, failed: 0 };

  const items = await deps.store.claimBatch(config.batchSize);
  summary.claimed = items.length;

  for (const item of items) {
    const base = {
      outboxId: item.id,
      kind: item.kind,
      reference: item.enquiry.reference,
      correlationId: item.correlationId,
      attempt: item.attempts,
    };
    const logMarkFailure = async (error: unknown) => {
      // The lease will expire and the item will be claimed again.
      deps.logger.error("outbox.mark_failed", {
        ...base,
        error: error instanceof Error ? error.name : "unknown",
      });
    };

    if (item.attempts > config.maxAttempts) {
      // A lease expired repeatedly (worker crashes). Stop retrying without another send.
      try {
        await deps.store.markFailed(item.id, item.attempts, "max-attempts-exceeded");
        summary.failed += 1;
        deps.logger.error("outbox.dead_letter", { ...base, errorCode: "max-attempts-exceeded" });
      } catch (error) {
        await logMarkFailure(error);
      }
      continue;
    }

    try {
      await deps.notifier.send({
        kind: item.kind,
        idempotencyKey: `${item.enquiry.id}:${item.kind}`,
        correlationId: item.correlationId,
        enquiry: item.enquiry,
      });
    } catch (error) {
      const { code, retryable } = errorCodeOf(error);
      try {
        if (!retryable || item.attempts >= config.maxAttempts) {
          await deps.store.markFailed(item.id, item.attempts, code);
          summary.failed += 1;
          deps.logger.error("outbox.dead_letter", { ...base, errorCode: code });
        } else {
          const delay = backoffSeconds(item.attempts, config);
          await deps.store.scheduleRetry(item.id, item.attempts, delay, code);
          summary.retried += 1;
          deps.logger.warn("outbox.retry_scheduled", {
            ...base,
            errorCode: code,
            delaySeconds: delay,
          });
        }
      } catch (markError) {
        await logMarkFailure(markError);
      }
      continue;
    }

    // Sent. If recording that fails, the lease expires and the item is re-sent (at-least-once);
    // the stable idempotency key lets the provider de-duplicate.
    try {
      await deps.store.markSent(item.id, item.attempts);
      summary.sent += 1;
      deps.logger.info("outbox.sent", base);
    } catch (markError) {
      await logMarkFailure(markError);
    }
  }
  return summary;
}
