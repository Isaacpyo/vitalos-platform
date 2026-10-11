import type { EnquiryLogger, RetentionStore } from "../domain/ports";

export interface PurgeSummary {
  purged: number;
}

export interface PurgeDeps {
  store: RetentionStore;
  logger: EnquiryLogger;
}

/** Deletes enquiries past their retention date. Logs and returns a count only, never content. */
export async function purgeExpiredEnquiries(deps: PurgeDeps): Promise<PurgeSummary> {
  const purged = await deps.store.purgeExpired();
  deps.logger.info("retention.purged", { purged });
  return { purged };
}
