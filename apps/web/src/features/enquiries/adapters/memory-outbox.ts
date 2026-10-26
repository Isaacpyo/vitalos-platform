import type { Clock, OutboxItem, OutboxStore } from "../domain/ports";
import { systemClock } from "../domain/ports";
import { enquiryDetailsFor } from "../healthcare";
import type { MemoryEnquiryRepository, MemoryOutboxRow } from "./memory-repository";

const LEASE_SECONDS = 300;

/** In-process outbox over the memory repository's rows. Same claim/lease rules as Postgres. */
export class MemoryOutboxStore implements OutboxStore {
  constructor(
    private readonly repository: MemoryEnquiryRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  claimBatch(limit: number): Promise<OutboxItem[]> {
    const now = this.clock.now();
    const due = this.repository.outbox
      .filter(
        (row) =>
          (row.state === "pending" && row.availableAt <= now) ||
          (row.state === "processing" && (row.lockedUntil === undefined || row.lockedUntil < now)),
      )
      .sort((a, b) => a.availableAt.getTime() - b.availableAt.getTime())
      .slice(0, Math.max(1, Math.min(limit, 50)));

    const items = due.map((row): OutboxItem => {
      row.state = "processing";
      row.attempts += 1;
      row.lockedUntil = new Date(now.getTime() + LEASE_SECONDS * 1000);
      const enquiry = this.repository.enquiries.get(row.enquiryId);
      if (!enquiry) throw new Error("orphaned outbox row");
      return {
        id: row.id,
        kind: row.kind,
        attempts: row.attempts,
        correlationId: row.correlationId,
        event: this.repository.eventFor(row),
        enquiry: {
          id: enquiry.id,
          reference: enquiry.reference,
          name: enquiry.name,
          organisation: enquiry.organisation,
          workEmail: enquiry.workEmail,
          role: enquiry.role,
          goal: enquiry.goal,
          timeframe: enquiry.timeframe,
          budgetRange: enquiry.budgetRange,
          intent: enquiry.intent,
          offerSlug: enquiry.offerSlug,
          sourcePath: enquiry.sourcePath,
          receivedAt: enquiry.receivedAt.toISOString(),
          details: enquiryDetailsFor(enquiry),
        },
      };
    });
    return Promise.resolve(items);
  }

  markSent(id: string, attempts: number): Promise<void> {
    this.update(id, attempts, { state: "sent", lastError: undefined });
    return Promise.resolve();
  }

  scheduleRetry(
    id: string,
    attempts: number,
    delaySeconds: number,
    errorCode: string,
  ): Promise<void> {
    this.update(id, attempts, {
      state: "pending",
      lastError: errorCode,
      availableAt: new Date(this.clock.now().getTime() + delaySeconds * 1000),
    });
    return Promise.resolve();
  }

  markFailed(id: string, attempts: number, errorCode: string): Promise<void> {
    this.update(id, attempts, { state: "failed", lastError: errorCode });
    return Promise.resolve();
  }

  private update(id: string, attempts: number, patch: Partial<MemoryOutboxRow>) {
    const row = this.repository.outbox.find((candidate) => candidate.id === id);
    // Like mark_outbox: only a row being processed, under the same lease token, can be marked.
    if (!row || row.state !== "processing" || row.attempts !== attempts) return;
    Object.assign(row, patch, { lockedUntil: undefined });
  }
}
