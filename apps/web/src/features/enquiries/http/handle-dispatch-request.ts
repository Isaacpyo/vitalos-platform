import { createHash, timingSafeEqual } from "node:crypto";
import type { EnquiryService } from "../composition";
import { correlationIdFrom } from "./request-guards";

export interface DispatchRequestDeps {
  service: EnquiryService;
  /** `OUTBOX_DISPATCH_SECRET`. Undefined means the endpoint is not configured. */
  secret: string | undefined;
}

const respond = (
  body: Record<string, unknown>,
  status: number,
  correlationId: string,
  extra: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-request-id": correlationId, ...extra },
  });

/** Constant-time comparison: digests have equal length, so length never leaks. */
export function bearerMatches(header: string | null, secret: string): boolean {
  const presented = /^Bearer (.+)$/.exec(header ?? "")?.[1] ?? "";
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/**
 * Internal outbox dispatch endpoint. Not a public API: it requires the shared bearer secret and
 * is intended for a scheduler (none is configured yet: Vercel Cron is blocked on owner approval)
 * or `tooling/scripts/dispatch-outbox-local.mjs`. Returns counts only, never enquiry content.
 */
export async function handleDispatchRequest(
  request: Request,
  deps: DispatchRequestDeps,
): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  if (!deps.secret) return respond({ error: "unavailable" }, 503, correlationId);
  if (!bearerMatches(request.headers.get("authorization"), deps.secret)) {
    return respond({ error: "unauthorized" }, 401, correlationId, {
      "www-authenticate": "Bearer",
    });
  }
  if (!deps.service.available) return respond({ error: "unavailable" }, 503, correlationId);

  const summary = await deps.service.dispatch();
  if (summary === null) {
    // No notifier configured: items stay pending, which is safe. Say so rather than pretend.
    return respond({ error: "notifications-not-configured" }, 503, correlationId);
  }
  return respond({ status: "ok", ...summary }, 200, correlationId);
}
