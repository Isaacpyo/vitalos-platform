import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Content API request signing, scheme `v1` (contracts/content-api/v1/openapi.yaml, ADR-040).
 *
 * Canonical string (joined with `\n`, no trailing newline):
 *
 *     v1
 *     {scope}
 *     {timestamp}
 *     {METHOD}
 *     {path and query string exactly as sent}
 *     {lowercase hex SHA-256 of the raw body; the hash of the empty string for GET}
 *
 * Headers: `X-Vitalos-Key-Id`, `X-Vitalos-Timestamp` (Unix seconds) and
 * `X-Vitalos-Signature: v1=<lowercase hex HMAC-SHA256>`. The receiver refuses a timestamp more
 * than 300 s from its clock, compares in constant time and accepts any key in its list, so keys
 * rotate with no downtime. Pure Node `crypto`, no framework imports.
 */

export const signingScopes = ["read", "tick", "submit", "revalidate", "render", "preview", "assist"] as const;
export type SigningScope = (typeof signingScopes)[number];

export interface SigningKey {
  id: string;
  secret: string;
}

export const KEY_ID_HEADER = "x-vitalos-key-id";
export const TIMESTAMP_HEADER = "x-vitalos-timestamp";
export const SIGNATURE_HEADER = "x-vitalos-signature";
export const PREVIEW_TOKEN_HEADER = "x-vitalos-preview-token";

/** Maximum distance between the sender's timestamp and the receiver's clock. */
export const MAX_SKEW_SECONDS = 300;

const keyIdPattern = /^[a-z0-9-]{1,32}$/;
const timestampPattern = /^\d{1,12}$/;
const signaturePattern = /^v1=([0-9a-f]{64})$/;

export const sha256Hex = (body: string | Uint8Array): string =>
  createHash("sha256").update(body).digest("hex");

export function canonicalString(input: {
  scope: SigningScope;
  timestamp: number;
  method: string;
  pathAndQuery: string;
  body: string | Uint8Array;
}): string {
  return [
    "v1",
    input.scope,
    String(input.timestamp),
    input.method.toUpperCase(),
    input.pathAndQuery,
    sha256Hex(input.body),
  ].join("\n");
}

const hmacHex = (secret: string, value: string): string =>
  createHmac("sha256", secret).update(value).digest("hex");

/** Constant-time comparison of two equal-format hex strings (lengths are fixed by the pattern). */
function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface SignRequestInput {
  key: SigningKey;
  scope: SigningScope;
  method: string;
  /** Path and query string exactly as they will be sent, e.g. `/api/content/v1/home`. */
  pathAndQuery: string;
  body?: string | Uint8Array;
  /** Unix seconds; defaults to now. */
  timestamp?: number;
}

/** The three signing headers for one request. */
export function signRequest(input: SignRequestInput): Record<string, string> {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = hmacHex(
    input.key.secret,
    canonicalString({
      scope: input.scope,
      timestamp,
      method: input.method,
      pathAndQuery: input.pathAndQuery,
      body: input.body ?? "",
    }),
  );
  return {
    [KEY_ID_HEADER]: input.key.id,
    [TIMESTAMP_HEADER]: String(timestamp),
    [SIGNATURE_HEADER]: `v1=${signature}`,
  };
}

export type VerifyFailure =
  "missing" | "malformed" | "stale" | "unknown-key" | "bad-signature" | "not-configured";

export type VerifyResult = { ok: true; keyId: string } | { ok: false; reason: VerifyFailure };

export interface VerifyRequestInput {
  headers: { get(name: string): string | null };
  keys: readonly SigningKey[];
  scope: SigningScope;
  method: string;
  pathAndQuery: string;
  body: string | Uint8Array;
  /** Unix seconds; defaults to now. */
  now?: number;
}

/**
 * Verifies a signed request. The key is chosen by `X-Vitalos-Key-Id` from `keys`; a key listed
 * for another scope is never in `keys`, so a wrong-scope request fails on the key id or, if ids
 * collide, on the signature (the scope is part of the canonical string).
 */
export function verifyRequest(input: VerifyRequestInput): VerifyResult {
  if (input.keys.length === 0) return { ok: false, reason: "not-configured" };
  const keyId = input.headers.get(KEY_ID_HEADER);
  const timestampText = input.headers.get(TIMESTAMP_HEADER);
  const signatureText = input.headers.get(SIGNATURE_HEADER);
  if (!keyId || !timestampText || !signatureText) return { ok: false, reason: "missing" };
  const signature = signaturePattern.exec(signatureText)?.[1];
  if (!keyIdPattern.test(keyId) || !timestampPattern.test(timestampText) || !signature) {
    return { ok: false, reason: "malformed" };
  }
  const timestamp = Number(timestampText);
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > MAX_SKEW_SECONDS) return { ok: false, reason: "stale" };

  const expected = canonicalString({
    scope: input.scope,
    timestamp,
    method: input.method,
    pathAndQuery: input.pathAndQuery,
    body: input.body,
  });
  // Every listed key with this id is checked (ids are unique in practice); no early exit on a
  // mismatch, so timing does not reveal which key failed.
  let matched = false;
  let known = false;
  for (const key of input.keys) {
    if (key.id !== keyId) continue;
    known = true;
    if (safeEqualHex(hmacHex(key.secret, expected), signature)) matched = true;
  }
  if (!known) return { ok: false, reason: "unknown-key" };
  return matched ? { ok: true, keyId } : { ok: false, reason: "bad-signature" };
}

/** `pathname + search` of a request URL: what the sender signed. */
export function pathAndQueryOf(url: string | URL): string {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return `${parsed.pathname}${parsed.search}`;
}

// ---------------------------------------------------------------------------------------------
// Preview tokens (scope `preview`)
// ---------------------------------------------------------------------------------------------

/** Preview token lifetime set by the admin (contract): 15 minutes. */
export const PREVIEW_TOKEN_TTL_SECONDS = 15 * 60;

export interface PreviewTokenPayload {
  v: 1;
  kid: string;
  entity: "post" | "role";
  id: string;
  rev: string;
  exp: number;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const base64urlPattern = /^[A-Za-z0-9_-]+$/;

const toBase64url = (value: string | Buffer): string => Buffer.from(value).toString("base64url");

/**
 * `base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, base64url(JSON payload)))`.
 * The admin signs real tokens; this exists for tests and local tooling.
 */
export function signPreviewToken(
  payload: Omit<PreviewTokenPayload, "v" | "kid" | "exp"> & { exp?: number },
  key: SigningKey,
  now: number = Math.floor(Date.now() / 1000),
): string {
  const full: PreviewTokenPayload = {
    v: 1,
    kid: key.id,
    entity: payload.entity,
    id: payload.id,
    rev: payload.rev,
    exp: payload.exp ?? now + PREVIEW_TOKEN_TTL_SECONDS,
  };
  const body = toBase64url(JSON.stringify(full));
  const mac = createHmac("sha256", key.secret).update(body).digest();
  return `${body}.${toBase64url(mac)}`;
}

export type PreviewTokenResult =
  | { ok: true; payload: PreviewTokenPayload }
  | {
      ok: false;
      reason: "malformed" | "unknown-key" | "bad-signature" | "expired" | "not-configured";
    };

function parsePayload(value: unknown): PreviewTokenPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { v, kid, entity, id, rev, exp } = record;
  if (v !== 1) return null;
  if (typeof kid !== "string" || !keyIdPattern.test(kid)) return null;
  if (entity !== "post" && entity !== "role") return null;
  if (typeof id !== "string" || !uuidPattern.test(id)) return null;
  if (typeof rev !== "string" || rev.length === 0 || rev.length > 128) return null;
  if (typeof exp !== "number" || !Number.isSafeInteger(exp)) return null;
  return { v, kid, entity, id, rev, exp };
}

/** Verifies a preview token's signature (key chosen by `kid`) and expiry. */
export function verifyPreviewToken(
  token: string,
  keys: readonly SigningKey[],
  now: number = Math.floor(Date.now() / 1000),
): PreviewTokenResult {
  if (keys.length === 0) return { ok: false, reason: "not-configured" };
  if (token.length > 2000) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, mac] = parts as [string, string];
  if (!base64urlPattern.test(body) || !base64urlPattern.test(mac)) {
    return { ok: false, reason: "malformed" };
  }
  let payload: PreviewTokenPayload | null;
  try {
    payload = parsePayload(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  } catch {
    payload = null;
  }
  if (!payload) return { ok: false, reason: "malformed" };
  const key = keys.find((candidate) => candidate.id === payload.kid);
  if (!key) return { ok: false, reason: "unknown-key" };
  const expected = createHmac("sha256", key.secret).update(body).digest();
  const presented = Buffer.from(mac, "base64url");
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    return { ok: false, reason: "bad-signature" };
  }
  if (payload.exp <= now) return { ok: false, reason: "expired" };
  // A token valid for far longer than the admin ever issues is refused too.
  if (payload.exp - now > PREVIEW_TOKEN_TTL_SECONDS + MAX_SKEW_SECONDS) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
