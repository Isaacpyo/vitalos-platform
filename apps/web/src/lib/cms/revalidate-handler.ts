import {
  MAX_BODY_BYTES,
  SIGNATURE_HEADER,
  hasSignatureShape,
  tagsForPayload,
  verifySanitySignature,
} from "./webhook";

export interface RevalidateDeps {
  /** `SANITY_REVALIDATE_SECRET`; undefined means the endpoint is not configured. */
  secret: string | undefined;
  /** Marks a tag stale. `{ expire: 0 }`: the next request blocks and reads fresh content. */
  revalidateTag(tag: string, profile: { expire: number }): void;
  now?: () => number;
  log?(event: string, attributes?: Record<string, unknown>): void;
}

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Reads the request body as text, stopping as soon as it exceeds `limit` bytes. A chunked body
 * with no Content-Length is therefore never buffered beyond the limit. Returns null when over.
 */
export async function readLimited(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * POST handler for the Sanity webhook. Fail-closed: without a configured secret the endpoint
 * answers 503 and never revalidates; an unsigned, stale or forged request answers 401 and
 * nothing is revalidated. Responses never echo request content.
 */
export function createRevalidateHandler(deps: RevalidateDeps) {
  return async function POST(request: Request): Promise<Response> {
    if (!deps.secret) return json({ error: "not_configured" }, 503);

    // Unsigned requests are refused before any body is read.
    const header = request.headers.get(SIGNATURE_HEADER);
    if (!hasSignatureShape(header)) {
      deps.log?.("cms.revalidate.rejected");
      return json({ error: "invalid_signature" }, 401);
    }

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

    const body = await readLimited(request, MAX_BODY_BYTES);
    if (body === null) return json({ error: "payload_too_large" }, 413);

    const valid = verifySanitySignature({
      body,
      header,
      secret: deps.secret,
      ...(deps.now ? { now: deps.now() } : {}),
    });
    if (!valid) {
      deps.log?.("cms.revalidate.rejected");
      return json({ error: "invalid_signature" }, 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const tags = tagsForPayload(payload);
    for (const tag of tags) deps.revalidateTag(tag, { expire: 0 });
    deps.log?.("cms.revalidate.accepted", { tagCount: tags.length });
    return json({ revalidated: tags }, 200);
  };
}
