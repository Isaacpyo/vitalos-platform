import { createHash, createHmac } from "node:crypto";
import { safeEqual } from "../util/tokens";

/**
 * Signing for the website ⇄ Super Admin interfaces (docs/relay/API.md):
 *
 *   canonical = ts + "\n" + METHOD + "\n" + pathWithQuery + "\n" + adminHeader + "\n" + sha256hex(body)
 *   X-Relay-Signature: v1=<hex HMAC-SHA256(secret, canonical)>
 */
export const SIGNATURE_WINDOW_SECONDS = 300;

export function canonicalString(input: {
  timestamp: string;
  method: string;
  pathWithQuery: string;
  adminHeader: string;
  body: string | Uint8Array;
}): string {
  const bodyHash = createHash("sha256").update(input.body).digest("hex");
  return [
    input.timestamp,
    input.method.toUpperCase(),
    input.pathWithQuery,
    input.adminHeader,
    bodyHash,
  ].join("\n");
}

export function sign(secret: string, canonical: string): string {
  return `v1=${createHmac("sha256", secret).update(canonical, "utf8").digest("hex")}`;
}

export type VerifyResult = { ok: true } | { ok: false; code: "bad_signature" | "stale" };

/** Verifies a signature against one or more secrets (rotation window), in constant time. */
export function verifySignature(input: {
  secrets: readonly string[];
  timestamp: string | null;
  signature: string | null;
  method: string;
  pathWithQuery: string;
  adminHeader: string;
  body: string | Uint8Array;
  nowSeconds: number;
}): VerifyResult {
  if (!input.timestamp || !input.signature || !/^\d{9,11}$/.test(input.timestamp))
    return { ok: false, code: "bad_signature" };
  if (Math.abs(input.nowSeconds - Number(input.timestamp)) > SIGNATURE_WINDOW_SECONDS)
    return { ok: false, code: "stale" };
  const canonical = canonicalString({
    timestamp: input.timestamp,
    method: input.method,
    pathWithQuery: input.pathWithQuery,
    adminHeader: input.adminHeader,
    body: input.body,
  });
  const presented = input.signature;
  let match = false;
  for (const secret of input.secrets) {
    if (secret && safeEqual(sign(secret, canonical), presented)) match = true;
  }
  return match ? { ok: true } : { ok: false, code: "bad_signature" };
}
