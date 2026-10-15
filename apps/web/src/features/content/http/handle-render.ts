import type { Logger } from "@vitalos/observability";
import type { RateLimiter } from "@vitalos/security/rate-limit";
import type { RenderOptions, RenderResult } from "../markdown/render";
import { RenderRequest } from "../schemas";
import { pathAndQueryOf, verifyRequest } from "../signing";
import type { SigningKey } from "../signing";
import { correlationIdFrom, json, rateLimited, readBodyWithLimit } from "./guards";

/** The contract's limit for a render request body: 200 KB. */
export const MAX_RENDER_BYTES = 200 * 1024;

export interface RenderDeps {
  /** `CONTENT_RENDER_SECRET` keys; empty means not configured (503). */
  keys: readonly SigningKey[];
  limiter: RateLimiter;
  render(markdown: string, options: RenderOptions): Promise<RenderResult>;
  mediaOrigin: string | undefined;
  siteHosts: readonly string[];
  logger?: Pick<Logger, "info" | "warn">;
  /** Unix seconds. */
  now?: () => number;
}

/**
 * `POST /api/content/render` (ADR-035 3, brief A7): the admin's preview renders with the site's
 * one renderer. Signed (scope `render`), at most 200 KB (413), rate-limited, `no-store`. Returns
 * `{ html, toc, footnotes, warnings }`. Logs carry sizes and counts only, never the Markdown.
 */
export async function handleRenderRequest(request: Request, deps: RenderDeps): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  const limited = await rateLimited(deps.limiter, request.headers, "render", correlationId);
  if (limited) return limited;
  if (deps.keys.length === 0) return json({ error: "unavailable" }, 503, correlationId);

  const body = await readBodyWithLimit(request, MAX_RENDER_BYTES);
  if (!body.ok) {
    return body.reason === "too-large"
      ? json({ error: "payload_too_large" }, 413, correlationId)
      : json({ error: "invalid" }, 400, correlationId);
  }

  const verified = verifyRequest({
    headers: request.headers,
    keys: deps.keys,
    scope: "render",
    method: request.method,
    pathAndQuery: pathAndQueryOf(request.url),
    body: body.text,
    ...(deps.now ? { now: deps.now() } : {}),
  });
  if (!verified.ok) {
    deps.logger?.warn("content.render.refused", { correlationId, reason: verified.reason });
    return json({ error: "unauthorized" }, 401, correlationId);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return json({ error: "invalid" }, 400, correlationId);
  }
  const result = RenderRequest.safeParse(parsed);
  if (!result.success) return json({ error: "invalid" }, 400, correlationId);

  const started = Date.now();
  const rendered = await deps.render(result.data.markdown, {
    context: result.data.context,
    mediaOrigin: deps.mediaOrigin,
    siteHosts: deps.siteHosts,
  });
  deps.logger?.info("content.rendered", {
    correlationId,
    context: result.data.context,
    bytes: body.text.length,
    warnings: rendered.warnings.length,
    durationMs: Date.now() - started,
  });
  return json(rendered, 200, correlationId);
}
