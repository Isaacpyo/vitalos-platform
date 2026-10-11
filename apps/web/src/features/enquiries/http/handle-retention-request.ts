import type { EnquiryService } from "../composition";
import { bearerMatches } from "./handle-dispatch-request";
import { correlationIdFrom } from "./request-guards";

export interface RetentionRequestDeps {
  service: EnquiryService;
  /** Same accepted bearer secrets as the dispatch endpoint: `OUTBOX_DISPATCH_SECRET`, `CRON_SECRET`. */
  secrets: readonly (string | undefined)[];
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

/**
 * Internal retention purge endpoint (owner decision 2026-10-11: enquiries are deleted 24 months
 * after the last contact). Not a public API: it requires the shared bearer secret and is called by
 * the daily Vercel Cron (`apps/web/vercel.json`). Returns a count only, never enquiry content.
 */
export async function handleRetentionRequest(
  request: Request,
  deps: RetentionRequestDeps,
): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  const secrets = deps.secrets.filter((s): s is string => Boolean(s));
  if (secrets.length === 0) return respond({ error: "unavailable" }, 503, correlationId);
  const header = request.headers.get("authorization");
  // Check every secret (no short-circuit) so timing does not reveal which one matched.
  const authorised = secrets.map((s) => bearerMatches(header, s)).includes(true);
  if (!authorised) {
    return respond({ error: "unauthorized" }, 401, correlationId, {
      "www-authenticate": "Bearer",
    });
  }
  if (!deps.service.available) return respond({ error: "unavailable" }, 503, correlationId);

  try {
    const summary = await deps.service.purgeExpired();
    return respond({ status: "ok", purged: summary.purged }, 200, correlationId);
  } catch {
    // Store errors carry only a code, but nothing about them belongs in a response.
    return respond({ error: "unavailable" }, 503, correlationId);
  }
}
