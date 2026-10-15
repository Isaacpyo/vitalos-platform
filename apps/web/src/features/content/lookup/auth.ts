import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Authenticates the proxy's calls to the internal lookup route (ADR-036).
 *
 * The proxy and the route handlers are separate functions on Vercel (and may be separate
 * instances anywhere), so a per-process random secret would not be shared between them. The key
 * is therefore derived from the deployment's read secret (`CONTENT_READ_SECRET`), which every
 * instance of one deployment has, with a fixed label so it can never be mistaken for a request
 * signature: `HMAC-SHA256(readSecret, "vitalos-content-lookup-v1")`.
 *
 * Header: `x-vitalos-lookup: {unixSeconds}.{hex HMAC(key, "{unixSeconds}\n{path}")}`, accepted
 * for 60 s. A captured header only authorises the same verdict for the same path for a minute,
 * and the verdict is public information anyway (it is what the page itself would answer); the
 * point is that nobody else can make this route call the admin on their behalf.
 */

export const LOOKUP_AUTH_HEADER = "x-vitalos-lookup";
export const LOOKUP_MAX_SKEW_SECONDS = 60;

const deriveKey = (readSecret: string): Buffer =>
  createHmac("sha256", readSecret).update("vitalos-content-lookup-v1").digest();

const mac = (key: Buffer, timestamp: number, path: string): string =>
  createHmac("sha256", key).update(`${timestamp}\n${path}`).digest("hex");

export function signLookup(readSecret: string, path: string, now: number = nowSeconds()): string {
  return `${now}.${mac(deriveKey(readSecret), now, path)}`;
}

export function verifyLookup(
  readSecret: string | undefined,
  header: string | null,
  path: string,
  now: number = nowSeconds(),
): boolean {
  if (!readSecret || !header) return false;
  const match = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(header);
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (Math.abs(now - timestamp) > LOOKUP_MAX_SKEW_SECONDS) return false;
  const expected = Buffer.from(mac(deriveKey(readSecret), timestamp, path), "hex");
  const presented = Buffer.from(match[2] as string, "hex");
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
