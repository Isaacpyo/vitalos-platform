import { clientIpFromHeaders } from "@vitalos/security/rate-limit";
import type { ReceiveResult } from "../application/receive-enquiry";
import type { EnquiryService } from "../composition";
import {
  correlationIdFrom,
  isJsonContentType,
  isSameOrigin,
  MAX_BODY_BYTES,
  readBodyWithLimit,
} from "./request-guards";

export interface EnquiryRequestDeps {
  service: EnquiryService;
  /** Canonical site origin (no trailing slash). */
  siteOrigin: string;
  /** Schedules best-effort work after the response (Next.js `after`). */
  after: (task: () => Promise<unknown>) => void;
}

const baseHeaders = (correlationId: string): Record<string, string> => ({
  "cache-control": "no-store",
  "x-request-id": correlationId,
});

const json = (
  body: Record<string, unknown>,
  status: number,
  correlationId: string,
  extra: Record<string, string> = {},
) => Response.json(body, { status, headers: { ...baseHeaders(correlationId), ...extra } });

export function resultToResponse(result: ReceiveResult, correlationId: string): Response {
  switch (result.kind) {
    case "accepted":
      return json({ status: "accepted", reference: result.reference }, 202, correlationId);
    case "invalid":
      return json({ error: "invalid", fieldErrors: result.fieldErrors }, 400, correlationId);
    case "rejected":
      return json({ error: "rejected" }, 403, correlationId);
    case "rate-limited":
      return json(
        { error: "rate-limited", retryAfterSeconds: result.retryAfterSeconds },
        429,
        correlationId,
        { "retry-after": String(result.retryAfterSeconds) },
      );
    case "unavailable":
      return json({ error: "unavailable" }, 503, correlationId);
  }
}

/**
 * Best-effort dispatch after the response. The outbox row already guarantees delivery is retried,
 * so a failure to schedule (for example `after()` outside a request scope) or to run must never
 * turn a stored enquiry into an error response.
 */
export function scheduleDispatch(deps: Pick<EnquiryRequestDeps, "service" | "after">): void {
  try {
    deps.after(() => deps.service.dispatch().catch(() => null));
  } catch {
    // Ignored on purpose: the pending outbox row is picked up by the next dispatch run.
  }
}

/**
 * The enquiry JSON endpoint, framework-free. Cheap guards run first (origin, content type, size),
 * then the application service. Responses never echo submitted content.
 */
export async function handleEnquiryRequest(
  request: Request,
  deps: EnquiryRequestDeps,
): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);

  if (!isSameOrigin(request.headers, deps.siteOrigin)) {
    return json({ error: "forbidden" }, 403, correlationId);
  }
  if (!isJsonContentType(request.headers)) {
    return json({ error: "unsupported-media-type" }, 415, correlationId);
  }
  if (!deps.service.available) {
    return json({ error: "unavailable" }, 503, correlationId);
  }

  const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.reason === "too-large"
      ? json({ error: "payload-too-large" }, 413, correlationId)
      : json({ error: "invalid", fieldErrors: {} }, 400, correlationId);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return json({ error: "invalid", fieldErrors: {} }, 400, correlationId);
  }

  const result = await deps.service.receive({
    body: parsed,
    ip: clientIpFromHeaders(request.headers),
    correlationId,
  });
  if (result.kind === "accepted") {
    scheduleDispatch(deps);
  }
  return resultToResponse(result, correlationId);
}
