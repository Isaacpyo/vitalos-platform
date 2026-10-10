import { referenceFromId } from "../domain/enquiry";
import type { NewEnquiry, SubmittedEnquiry } from "../domain/enquiry";
import { ENQUIRY_RECEIVED_V1 } from "../domain/events";
import type { OutboxKind } from "../domain/events";
import type { Clock, EnquiryRepository } from "../domain/ports";
import { systemClock } from "../domain/ports";

export interface MemoryOutboxRow {
  id: string;
  enquiryId: string;
  kind: OutboxKind;
  state: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  availableAt: Date;
  lockedUntil: Date | undefined;
  lastError: string | undefined;
  correlationId: string | undefined;
}

export interface MemoryEnquiryRow extends NewEnquiry {
  id: string;
  reference: string;
  receivedAt: Date;
}

/**
 * In-process repository for tests and local development (`VITALOS_ENQUIRY_BACKEND=memory`).
 * Mirrors `submit_enquiry`: idempotent on the key, enquiry and outbox row created together.
 * State lives in process memory and is lost on restart; production configuration rejects it.
 */
export class MemoryEnquiryRepository implements EnquiryRepository {
  readonly enquiries = new Map<string, MemoryEnquiryRow>();
  readonly outbox: MemoryOutboxRow[] = [];

  constructor(private readonly clock: Clock = systemClock) {}

  submit(enquiry: NewEnquiry): Promise<SubmittedEnquiry> {
    const existing = [...this.enquiries.values()].find(
      (row) => row.idempotencyKey === enquiry.idempotencyKey,
    );
    if (existing) {
      return Promise.resolve({ id: existing.id, reference: existing.reference, duplicate: true });
    }
    const id = crypto.randomUUID();
    const reference = referenceFromId(id);
    const now = this.clock.now();
    this.enquiries.set(id, { ...enquiry, id, reference, receivedAt: now });
    this.outbox.push({
      id: crypto.randomUUID(),
      enquiryId: id,
      kind: "internal-notification",
      state: "pending",
      attempts: 0,
      availableAt: now,
      lockedUntil: undefined,
      lastError: undefined,
      correlationId: enquiry.correlationId,
    });
    return Promise.resolve({ id, reference, duplicate: false });
  }

  findByIdempotencyKey(key: string): Promise<SubmittedEnquiry | null> {
    const existing = [...this.enquiries.values()].find((row) => row.idempotencyKey === key);
    return Promise.resolve(
      existing ? { id: existing.id, reference: existing.reference, duplicate: true } : null,
    );
  }

  /** Event envelope for an outbox row; identifiers only, like the database payload. */
  eventFor(row: MemoryOutboxRow) {
    const enquiry = this.enquiries.get(row.enquiryId);
    if (!enquiry) throw new Error("orphaned outbox row");
    return {
      eventId: row.id,
      eventType: ENQUIRY_RECEIVED_V1,
      eventVersion: 1,
      occurredAt: enquiry.receivedAt.toISOString(),
      producer: "vitalos-web",
      correlationId: row.correlationId ?? null,
      payload: {
        enquiryId: enquiry.id,
        reference: enquiry.reference,
        intent: enquiry.intent,
        offerSlug: enquiry.offerSlug ?? null,
        sourcePath: enquiry.sourcePath,
      },
    };
  }
}
