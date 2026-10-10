/**
 * Pure request guards for the enquiry JSON endpoint. No Next.js imports: they take `Headers` and
 * streams, so they are unit-testable and the route handler stays thin.
 */

/** Enquiry bodies are small. 5000 goal characters at up to 4 bytes each plus the other fields. */
export const MAX_BODY_BYTES = 32 * 1024;

const requestIdPattern = /^[A-Za-z0-9._-]{8,64}$/;

/** Reuses a well-formed inbound `x-request-id`, otherwise mints one. */
export function correlationIdFrom(headers: Headers): string {
  const inbound = headers.get("x-request-id");
  return inbound && requestIdPattern.test(inbound) ? inbound : crypto.randomUUID();
}

/**
 * Same-origin check for a browser-originated mutation (CSRF defence in depth; the endpoint also
 * needs a JSON content type, which a cross-site HTML form cannot send).
 *
 * `Origin` is mandatory: browsers always send it on cross-origin and same-origin POSTs.
 * It must equal the site origin or the origin served by this request's Host. `Sec-Fetch-Site`,
 * when present, must say `same-origin`.
 */
export function isSameOrigin(headers: Headers, siteOrigin: string): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") return false;

  const origin = headers.get("origin");
  if (!origin || !URL.canParse(origin)) return false;
  const parsed = new URL(origin);
  if (parsed.origin === siteOrigin) return true;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  return host !== null && parsed.host === host.split(",")[0]?.trim();
}

export const isJsonContentType = (headers: Headers): boolean =>
  /^application\/json\s*(;|$)/i.test(headers.get("content-type") ?? "");

export type BodyRead =
  { ok: true; text: string } | { ok: false; reason: "too-large" | "unreadable" };

/** Reads at most `limit` bytes. Never buffers an oversized body: it cancels the stream instead. */
export async function readBodyWithLimit(
  request: Request,
  limit: number = MAX_BODY_BYTES,
): Promise<BodyRead> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return { ok: false, reason: "too-large" };
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder("utf-8", { fatal: false }).decode(buffer) };
}
