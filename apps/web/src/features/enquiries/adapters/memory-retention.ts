import type { Clock, RetentionStore } from "../domain/ports";
import { systemClock } from "../domain/ports";
import type { MemoryEnquiryRepository } from "./memory-repository";

/** Months of retention after receipt; mirrors the database default (migration 20261011110000). */
export const RETENTION_MONTHS = 24;

export function retentionDeadline(receivedAt: Date): Date {
  const deadline = new Date(receivedAt.getTime());
  deadline.setUTCMonth(deadline.getUTCMonth() + RETENTION_MONTHS);
  return deadline;
}

/** In-process retention: same rule as `purge_expired_enquiries` (enquiry and outbox rows go together). */
export class MemoryRetentionStore implements RetentionStore {
  constructor(
    private readonly repository: MemoryEnquiryRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  purgeExpired(): Promise<number> {
    const now = this.clock.now();
    let purged = 0;
    for (const [id, row] of [...this.repository.enquiries]) {
      if (retentionDeadline(row.receivedAt) >= now) continue;
      this.repository.enquiries.delete(id);
      for (let i = this.repository.outbox.length - 1; i >= 0; i--) {
        if (this.repository.outbox[i]?.enquiryId === id) this.repository.outbox.splice(i, 1);
      }
      purged += 1;
    }
    return Promise.resolve(purged);
  }
}
