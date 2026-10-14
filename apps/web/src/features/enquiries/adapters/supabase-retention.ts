import type { RetentionStore } from "../domain/ports";
import { callRpc, EnquiryStoreError } from "./supabase-rpc";
import type { RpcClient } from "./supabase-rpc";

/** Retention over `purge_expired_enquiries()` (service role only; returns a count). */
export class SupabaseRetentionStore implements RetentionStore {
  constructor(private readonly client: RpcClient) {}

  async purgeExpired(): Promise<number> {
    const data = await callRpc(this.client, "purge_expired_enquiries", {});
    if (typeof data !== "number" || !Number.isInteger(data) || data < 0) {
      throw new EnquiryStoreError("unexpected-result");
    }
    return data;
  }
}
