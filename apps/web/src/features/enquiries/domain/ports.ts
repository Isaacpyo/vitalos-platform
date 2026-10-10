import type { EnquiryForNotification, NewEnquiry, SubmittedEnquiry } from "./enquiry";
import type { EnquiryReceivedV1, OutboxKind } from "./events";

/**
 * Ports. Application code depends on these; adapters (Supabase, Cloudflare, console, memory)
 * implement them. Any port may throw: the application layer treats that as "unavailable".
 */

export interface EnquiryRepository {
  /**
   * Stores the enquiry and queues its outbox event atomically. Replaying an idempotency key
   * returns the original enquiry with `duplicate: true` and stores nothing.
   */
  submit(enquiry: NewEnquiry): Promise<SubmittedEnquiry>;
  /**
   * Looks up an earlier submission by idempotency key, so a retry can be answered with the
   * original reference without spending a human check or a rate-limit token. Null when unknown.
   */
  findByIdempotencyKey(key: string): Promise<SubmittedEnquiry | null>;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, opts: { windowSeconds: number; max: number }): Promise<RateLimitDecision>;
}

export type HumanVerification = "passed" | "failed" | "disabled";

export interface HumanVerifier {
  /** `disabled` when no verifier is configured. A provider outage throws (fail closed). */
  verify(input: { token: string | undefined; ip: string | undefined }): Promise<HumanVerification>;
}

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  /** Attempts including the current one (incremented when the item was claimed). */
  attempts: number;
  correlationId: string | undefined;
  event: EnquiryReceivedV1;
  enquiry: EnquiryForNotification;
}

export interface OutboxStore {
  claimBatch(limit: number): Promise<OutboxItem[]>;
  /**
   * The mark operations take the `attempts` value returned by the claim: it is the lease token.
   * A worker whose lease expired and whose row was re-claimed holds a stale token, so its mark
   * is a no-op and cannot overwrite the new holder's outcome.
   */
  markSent(id: string, attempts: number): Promise<void>;
  /** Puts the item back to pending, due after `delaySeconds`. */
  scheduleRetry(
    id: string,
    attempts: number,
    delaySeconds: number,
    errorCode: string,
  ): Promise<void>;
  /** Terminal: attempts exhausted or a permanent error. Stays visible for operators. */
  markFailed(id: string, attempts: number, errorCode: string): Promise<void>;
}

export interface NotificationMessage {
  kind: OutboxKind;
  /** Stable per (enquiry, kind): lets a provider de-duplicate a re-delivery. */
  idempotencyKey: string;
  correlationId: string | undefined;
  enquiry: EnquiryForNotification;
}

/** Thrown by notifiers. `code` is stored and logged, so it must never contain personal data. */
export class NotificationError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, options: { retryable: boolean }) {
    super(code);
    this.name = "NotificationError";
    this.code = code;
    this.retryable = options.retryable;
  }
}

export interface Notifier {
  send(message: NotificationMessage): Promise<void>;
}

export interface Clock {
  now(): Date;
}

/** Structured logging port. Callers pass identifiers and counts only; never name, email or goal. */
export interface EnquiryLogger {
  info(event: string, fields?: Record<string, string | number | boolean | undefined>): void;
  warn(event: string, fields?: Record<string, string | number | boolean | undefined>): void;
  error(event: string, fields?: Record<string, string | number | boolean | undefined>): void;
}

export const systemClock: Clock = { now: () => new Date() };
