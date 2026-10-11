import { createHmac, timingSafeEqual } from "node:crypto";
import { tagsForDocument } from "./tags";

/**
 * Sanity webhook verification (ADR-018). Sanity signs the raw body: the
 * `sanity-webhook-signature` header is `t=<unix ms>,v1=<base64url HMAC-SHA256(secret, "<t>.<body>")>`.
 *
 * This is implemented here instead of through `next-sanity/webhook` because that helper compares
 * signatures with `!==` (not timing-safe), waits three seconds before returning, and parses the
 * body before checking authenticity. Here the body is verified first, compared in constant time
 * and bounded in size and age.
 */
export const SIGNATURE_HEADER = "sanity-webhook-signature";

/** Webhook payloads are a tiny projection (`_type`, slug). Anything larger is refused. */
export const MAX_BODY_BYTES = 64 * 1024;

/** Reject signatures older (or newer) than this, limiting replay of a captured request. */
export const SIGNATURE_TOLERANCE_MS = 10 * 60 * 1000;

const headerPattern = /^t=(\d{13})[, ]+v1=([A-Za-z0-9_-]{43})$/;

/** Cheap pre-check: the header is present and has the `t=...,v1=...` shape. */
export function hasSignatureShape(header: string | null): header is string {
  return header !== null && headerPattern.test(header.trim());
}

export interface VerifyOptions {
  body: string;
  header: string | null;
  secret: string;
  /** Injectable clock for tests. */
  now?: number;
  toleranceMs?: number;
}

export function verifySanitySignature({
  body,
  header,
  secret,
  now = Date.now(),
  toleranceMs = SIGNATURE_TOLERANCE_MS,
}: VerifyOptions): boolean {
  if (!header || !secret || !body) return false;
  const match = headerPattern.exec(header.trim());
  if (!match) return false;
  const [, timestamp, signature] = match;
  if (timestamp === undefined || signature === undefined) return false;
  if (Math.abs(now - Number(timestamp)) > toleranceMs) return false;

  const expected = createHmac("sha256", secret.trim())
    .update(`${timestamp}.${body}`)
    .digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // Both are 43 ASCII characters (checked above); the length guard keeps timingSafeEqual total.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cache tags to invalidate for a verified payload. Unknown shapes still refresh the root tag. */
export function tagsForPayload(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) return tagsForDocument(undefined, undefined);
  const record = payload as Record<string, unknown>;
  const rawSlug = record["slug"];
  const slug =
    typeof rawSlug === "string"
      ? rawSlug
      : typeof rawSlug === "object" && rawSlug !== null
        ? (rawSlug as Record<string, unknown>)["current"]
        : undefined;
  return tagsForDocument(record["_type"], slug);
}
