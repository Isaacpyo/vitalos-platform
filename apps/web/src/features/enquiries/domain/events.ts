/**
 * Event standard (Stage 0 section 42): an envelope with identifiers and a payload that describes
 * a fact that happened. Consumers must be idempotent. Payloads carry identifiers, never personal
 * data; the notifier loads what it needs from the enquiry record.
 */
export const ENQUIRY_RECEIVED_V1 = "enquiry.received.v1" as const;

export interface EventEnvelope<TType extends string, TPayload> {
  eventId: string;
  eventType: TType;
  eventVersion: number;
  occurredAt: string;
  producer: string;
  correlationId?: string | null;
  causationId?: string | null;
  payload: TPayload;
}

export type EnquiryReceivedV1 = EventEnvelope<
  typeof ENQUIRY_RECEIVED_V1,
  {
    enquiryId: string;
    reference: string;
    intent?: string | null;
    offerSlug?: string | null;
    sourcePath?: string | null;
  }
>;

/**
 * `internal-notification` tells the commercial inbox; `acknowledgement` is the customer receipt,
 * reserved until the owner approves it (stage-1 plan section 6).
 */
export const outboxKinds = ["internal-notification", "acknowledgement"] as const;
export type OutboxKind = (typeof outboxKinds)[number];
