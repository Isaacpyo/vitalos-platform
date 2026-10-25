import type { EnquiryInputV2 } from "@vitalos/validation";
import type { EnquiryDetailsRecord } from "../healthcare";

/**
 * Enquiry domain model. No framework or provider imports: adapters implement the ports in
 * `./ports.ts`, the application layer orchestrates them.
 */

/** A validated enquiry plus the facts the server adds. The honeypot and Turnstile token are gone. */
export type EnquiryDetails = Omit<EnquiryInputV2, "turnstileToken" | "website">;

export interface NewEnquiry extends EnquiryDetails {
  /** Salted hash of the client IP, or undefined when no address was available. Never the raw IP. */
  ipHash: string | undefined;
  correlationId: string;
}

/** Customer-facing reference, e.g. `VIT-1A2B3C4D5E6F` (48 bits of the enquiry id, derived by the database). */
export type EnquiryReference = string;

export interface SubmittedEnquiry {
  id: string;
  reference: EnquiryReference;
  /** True when the idempotency key had been used before: nothing new was stored. */
  duplicate: boolean;
}

/** The enquiry as the notifier needs it: personal data, only ever handed to a Notifier. */
export interface EnquiryForNotification {
  id: string;
  reference: EnquiryReference;
  name: string;
  organisation: string | undefined;
  workEmail: string;
  role: string | undefined;
  goal: string;
  timeframe: string | undefined;
  budgetRange: string | undefined;
  intent: string | undefined;
  offerSlug: string | undefined;
  sourcePath: string | undefined;
  receivedAt: string;
  /** Server-derived tags and structured answers (Health & Care); absent or empty otherwise. */
  details?: EnquiryDetailsRecord | undefined;
}

/** Mirrors the reference the database derives in `submit_enquiry`; used by in-memory adapters. */
export const referenceFromId = (id: string): EnquiryReference =>
  `VIT-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
