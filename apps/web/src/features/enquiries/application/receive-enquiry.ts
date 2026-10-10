import { rateLimitKey, saltedHash } from "@vitalos/security/rate-limit";
import { enquirySchemaV2, summariseEnquiryIssues } from "@vitalos/validation/enquiry";
import type { EnquiryFieldErrors } from "@vitalos/validation/enquiry";
import type { EnquiryReference, NewEnquiry } from "../domain/enquiry";
import type { EnquiryLogger, EnquiryRepository, HumanVerifier, RateLimiter } from "../domain/ports";

export type ReceiveResult =
  | { kind: "accepted"; reference: EnquiryReference }
  | { kind: "invalid"; fieldErrors: EnquiryFieldErrors }
  | { kind: "rejected" }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | { kind: "unavailable" };

export interface RateLimitPolicy {
  windowSeconds: number;
  max: number;
}

export interface ReceiveEnquiryDeps {
  repository: EnquiryRepository;
  rateLimiter: RateLimiter;
  verifier: HumanVerifier;
  logger: EnquiryLogger;
  /** Server-side secret used to hash the IP (stored and rate-limited by hash only). */
  ipHashSalt: string;
  /**
   * The privacy notice version currently in force. When set, a submission must present exactly
   * this value: consent is only recorded against the notice the server knows is current, never
   * against a client-chosen label. Unset only in local development and tests (production
   * configuration requires it).
   */
  privacyNoticeVersion?: string | undefined;
  limits?: { perIp: RateLimitPolicy; global: RateLimitPolicy };
}

export interface ReceiveRequest {
  /** Untrusted input: parsed JSON, or the form mapped by `enquiryInputFromForm`. */
  body: unknown;
  ip: string | undefined;
  correlationId: string;
}

export const defaultRateLimits = {
  perIp: { windowSeconds: 600, max: 10 },
  global: { windowSeconds: 3600, max: 300 },
} as const satisfies { perIp: RateLimitPolicy; global: RateLimitPolicy };

export const staleNoticeMessage =
  "The privacy notice has changed. Reload this page, read it and confirm again.";

/** SQLSTATE or adapter code from a failure, when it is a short safe token. Never the message. */
function errorCodeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(code) ? code : undefined;
}

/**
 * Receives an enquiry: validate, reject automation, rate limit per IP, answer a replay, verify
 * the human, charge the global limit, persist.
 *
 * Order matters. Cheap, local checks come first. A replayed idempotency key is answered with the
 * original reference BEFORE the Cloudflare call, so a retry after a lost response neither fails
 * on an already-spent token nor spends the global budget. The global bucket is charged only once
 * the human check has passed, so a flood of failing tokens cannot exhaust it and lock out real
 * visitors. Any dependency failure yields `unavailable` (fail closed). Nothing here logs the
 * submitted name, email or goal.
 */
export async function receiveEnquiry(
  deps: ReceiveEnquiryDeps,
  request: ReceiveRequest,
): Promise<ReceiveResult> {
  const { logger } = deps;
  const { correlationId } = request;
  const limits = deps.limits ?? defaultRateLimits;

  const parsed = enquirySchemaV2.safeParse(request.body);
  if (!parsed.success) {
    const summary = summariseEnquiryIssues(parsed.error);
    if (summary.honeypotTripped || summary.unknownKeys) {
      logger.warn("enquiry.rejected", {
        correlationId,
        reason: summary.honeypotTripped ? "honeypot" : "unknown-keys",
      });
      return { kind: "rejected" };
    }
    logger.info("enquiry.invalid", {
      correlationId,
      fields: Object.keys(summary.fieldErrors).join(","),
    });
    return { kind: "invalid", fieldErrors: summary.fieldErrors };
  }
  const { turnstileToken, website: _honeypot, ...details } = parsed.data;
  void _honeypot;

  if (deps.privacyNoticeVersion && details.privacyNoticeVersion !== deps.privacyNoticeVersion) {
    logger.info("enquiry.invalid", { correlationId, fields: "consent", reason: "stale-notice" });
    return { kind: "invalid", fieldErrors: { consent: staleNoticeMessage } };
  }

  try {
    const ipHash = request.ip ? await saltedHash(request.ip, deps.ipHashSalt) : undefined;

    const ipKey = await rateLimitKey("enquiry:ip", request.ip ?? "unknown", deps.ipHashSalt);
    const perIp = await deps.rateLimiter.consume(ipKey, limits.perIp);
    if (!perIp.allowed) {
      logger.warn("enquiry.rate_limited", { correlationId, scope: "ip" });
      return { kind: "rate-limited", retryAfterSeconds: Math.max(1, perIp.retryAfterSeconds) };
    }

    const replay = await deps.repository.findByIdempotencyKey(details.idempotencyKey);
    if (replay) {
      logger.info("enquiry.accepted", {
        correlationId,
        reference: replay.reference,
        duplicate: true,
        intent: details.intent,
      });
      return { kind: "accepted", reference: replay.reference };
    }

    const human = await deps.verifier.verify({ token: turnstileToken, ip: request.ip });
    if (human === "failed") {
      logger.warn("enquiry.rejected", { correlationId, reason: "human-verification" });
      return { kind: "rejected" };
    }

    const globalKey = await rateLimitKey("enquiry:global", "all", deps.ipHashSalt);
    const global = await deps.rateLimiter.consume(globalKey, limits.global);
    if (!global.allowed) {
      logger.warn("enquiry.rate_limited", { correlationId, scope: "global" });
      return { kind: "rate-limited", retryAfterSeconds: Math.max(1, global.retryAfterSeconds) };
    }

    const enquiry: NewEnquiry = { ...details, ipHash, correlationId };
    const stored = await deps.repository.submit(enquiry);
    logger.info("enquiry.accepted", {
      correlationId,
      reference: stored.reference,
      duplicate: stored.duplicate,
      intent: details.intent,
    });
    return { kind: "accepted", reference: stored.reference };
  } catch (error) {
    // Log the error class and a SQLSTATE/adapter code only: provider messages can echo request
    // content (Postgres constraint errors embed the failing row).
    logger.error("enquiry.unavailable", {
      correlationId,
      error: error instanceof Error ? error.name : "unknown",
      errorCode: errorCodeOf(error),
    });
    return { kind: "unavailable" };
  }
}
