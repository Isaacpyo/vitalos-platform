import type { Logger } from "@vitalos/observability";
import type { RateLimiter } from "@vitalos/security/rate-limit";
import { bearerMatches } from "../../enquiries/http/handle-dispatch-request";
import type { ContentClient } from "../client";
import { ContentUnavailableError } from "../client";
import type { ContentReaders } from "../readers";
import { TickResponse } from "../schemas";
import { correlationIdFrom, json, rateLimited } from "./guards";

export interface TickDeps {
  /** `CRON_SECRET`; unset means not configured (503). */
  cronSecret: string | undefined;
  limiter: RateLimiter;
  readers: Pick<ContentReaders, "siteState">;
  /** Null when the content API is not configured. */
  client: Pick<ContentClient, "post"> | null;
  /** Expires the cached site state so the new `nextDueAt` is read next. */
  expireSiteState(): void;
  logger?: Pick<Logger, "info" | "warn">;
  /** Milliseconds since the epoch. */
  now?: () => number;
}

/**
 * `GET /api/content/cron/tick` (ADR-042): the per-minute trigger (a Cloudflare Worker, plus a
 * daily Vercel cron as a backstop). It reads the cached site state and wakes the admin only when
 * `nextDueAt` has passed, so idle minutes cost the scaled-to-zero admin nothing. Then the `site`
 * tag is expired so the next read sees the admin's new `nextDueAt`.
 */
export async function handleTickRequest(request: Request, deps: TickDeps): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  if (!deps.cronSecret) return json({ error: "unavailable" }, 503, correlationId);
  if (!bearerMatches(request.headers.get("authorization"), deps.cronSecret)) {
    return json({ error: "unauthorized" }, 401, correlationId, { "www-authenticate": "Bearer" });
  }
  const limited = await rateLimited(deps.limiter, request.headers, "tick", correlationId);
  if (limited) return limited;
  if (!deps.client) return json({ status: "not_configured", ticked: false }, 200, correlationId);

  try {
    const state = await deps.readers.siteState();
    const due = state.nextDueAt ? Date.parse(state.nextDueAt) : Number.NaN;
    const now = deps.now?.() ?? Date.now();
    if (!Number.isFinite(due) || due > now) {
      return json({ status: "ok", ticked: false }, 200, correlationId);
    }
    const result = await deps.client.post("/api/content/v1/tick", {}, TickResponse, {
      scope: "tick",
    });
    deps.expireSiteState();
    deps.logger?.info("content.tick", {
      correlationId,
      promoted: result.promoted,
      closed: result.closed,
      delivered: result.delivered,
    });
    return json(
      {
        status: "ok",
        ticked: true,
        promoted: result.promoted,
        closed: result.closed,
        delivered: result.delivered,
      },
      200,
      correlationId,
    );
  } catch (error) {
    if (error instanceof ContentUnavailableError) {
      deps.logger?.warn("content.tick.failed", { correlationId, code: error.code });
      return json({ error: "unavailable" }, 503, correlationId);
    }
    throw error;
  }
}
