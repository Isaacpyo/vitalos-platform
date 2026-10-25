import { z } from "zod";
import type { NewEnquiry, SubmittedEnquiry } from "../domain/enquiry";
import { enquiryDetailsFor } from "../healthcare";
import type { EnquiryRepository } from "../domain/ports";
import { callRpc, EnquiryStoreError } from "./supabase-rpc";
import type { RpcClient } from "./supabase-rpc";

const submitResult = z.object({
  id: z.uuid(),
  reference: z.string().regex(/^VIT-[0-9A-F]{12}$/),
  duplicate: z.boolean(),
});

/** Maps the validated enquiry to the `submit_enquiry(p jsonb)` payload (camelCase keys). */
export const toSubmitPayload = (enquiry: NewEnquiry): Record<string, unknown> => ({
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
  utm: enquiry.utm ?? {},
  consent: enquiry.consent,
  privacyNoticeVersion: enquiry.privacyNoticeVersion,
  correlationId: enquiry.correlationId,
  ipHash: enquiry.ipHash,
  idempotencyKey: enquiry.idempotencyKey,
  details: enquiryDetailsFor(enquiry),
});

/** Stores the enquiry and its outbox event in one database transaction (`submit_enquiry`). */
export class SupabaseEnquiryRepository implements EnquiryRepository {
  constructor(private readonly client: RpcClient) {}

  async submit(enquiry: NewEnquiry): Promise<SubmittedEnquiry> {
    const data = await callRpc(this.client, "submit_enquiry", { p: toSubmitPayload(enquiry) });
    const parsed = submitResult.safeParse(data);
    if (!parsed.success) throw new EnquiryStoreError("unexpected-result");
    return parsed.data;
  }

  async findByIdempotencyKey(key: string): Promise<SubmittedEnquiry | null> {
    const data = await callRpc(this.client, "find_enquiry_reference", { p_key: key });
    if (data === null) return null;
    const parsed = submitResult.safeParse(data);
    if (!parsed.success) throw new EnquiryStoreError("unexpected-result");
    return parsed.data;
  }
}
