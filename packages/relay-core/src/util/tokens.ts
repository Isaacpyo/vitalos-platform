import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes, base64url (43 characters). */
export const randomToken = () => randomBytes(32).toString("base64url");

/** HMAC-SHA256 (hex) of a value under a server-side secret. */
export const hmacHex = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value, "utf8").digest("hex");

export const sha256Hex = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

/** Constant-time comparison of two strings (hex digests or tokens). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // Compare against itself to keep timing independent of where the lengths differ.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** "Visitor 8C1D": first four hex characters of the conversation id. */
export const visitorLabel = (conversationId: string) =>
  `Visitor ${conversationId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;

/** Initials from a display name ("Temitope Agbola" -> "TA"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? [parts[0]?.[0], parts.at(-1)?.[0]] : [parts[0]?.[0], parts[0]?.[1]];
  return letters.filter(Boolean).join("").toUpperCase().slice(0, 2) || "VT";
}

export const firstName = (name: string | null | undefined) =>
  (name ?? "").trim().split(/\s+/)[0] ?? "";
