import type { Logger } from "@vitalos/observability";
import type { RateLimiter } from "@vitalos/security/rate-limit";
import { RevalidateRequest } from "../schemas";
import { pathAndQueryOf, verifyRequest } from "../signing";
import type { SigningKey } from "../signing";
import { isKnownPath, isKnownTag, withSitemapChildren } from "../tags";
import { correlationIdFrom, json, rateLimited, readBodyWithLimit } from "./guards";

/** Revalidation bodies are small: at most 64 tags and 64 paths of 200 characters. */
export const MAX_REVALIDATE_BYTES = 64 * 1024;

export type RevalidateProfile = "max" | { expire: 0 };

export interface RevalidateDeps {
  /** `CONTENT_REVALIDATE_SECRET` keys; empty means not configured (503). */
  keys: readonly SigningKey[];
  limiter: RateLimiter;
  revalidateTag(tag: string, profile: RevalidateProfile): void;
  revalidatePath(path: string): void;
  /** Schedules best-effort warming GETs of the paths (after the response). */
  warm(paths: readonly string[]): void;
  /** Drops this instance's proxy lookup verdicts. */
  clearLookupVerdicts(): void;
  /**
   * Tells IndexNow engines that these page paths changed (ADR-043 decision 5), after the
   * response. Absent, or a no-op, outside the canonical host of production or without a key.
   */
  notifyIndexNow?(paths: readonly string[]): void;
  logger?: Pick<Logger, "info" | "warn">;
  /** Unix seconds. */
  now?: () => number;
}

/**
 * `POST /api/content/revalidate` (ADR-040): one sync event from the admin.
 *
 * Signature (scope `revalidate`) over the raw body; the body is validated with the contract's
 * zod schema, and every tag against `tags.json` and every path against its `pathPatterns` (400 on
 * anything unknown, before anything is revalidated).
 *
 * - `publish`: `revalidateTag(tag, "max")` (stale-while-revalidate), then warm each path so the
 *   new version renders while the old one is still served.
 * - `remove`: `revalidateTag(tag, { expire: 0 })` and `revalidatePath(path)`, so removed content
 *   is never served again.
 * - Insights and Careers page paths are then sent to IndexNow (`notifyIndexNow`, never blocking).
 * - `/sitemap.xml` in the paths brings `/sitemaps/insights.xml` and `/sitemaps/careers.xml` with
 *   it (both also carry the `sitemap` tag, so the tag alone already refreshes them).
 *
 * Replays are harmless (revalidation is idempotent) and bounded by the 300 s timestamp window.
 */
export async function handleRevalidateRequest(
  request: Request,
  deps: RevalidateDeps,
): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  const limited = await rateLimited(deps.limiter, request.headers, "revalidate", correlationId);
  if (limited) return limited;
  if (deps.keys.length === 0) return json({ error: "unavailable" }, 503, correlationId);

  const body = await readBodyWithLimit(request, MAX_REVALIDATE_BYTES);
  if (!body.ok) {
    return body.reason === "too-large"
      ? json({ error: "payload_too_large" }, 413, correlationId)
      : json({ error: "invalid" }, 400, correlationId);
  }

  const verified = verifyRequest({
    headers: request.headers,
    keys: deps.keys,
    scope: "revalidate",
    method: request.method,
    pathAndQuery: pathAndQueryOf(request.url),
    body: body.text,
    ...(deps.now ? { now: deps.now() } : {}),
  });
  if (!verified.ok) {
    deps.logger?.warn("content.revalidate.refused", { correlationId, reason: verified.reason });
    return json({ error: "unauthorized" }, 401, correlationId);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return json({ error: "invalid" }, 400, correlationId);
  }
  const result = RevalidateRequest.safeParse(parsed);
  if (!result.success) return json({ error: "invalid" }, 400, correlationId);
  const event = result.data;
  if (!event.tags.every(isKnownTag)) return json({ error: "unknown_tag" }, 400, correlationId);
  if (!event.paths.every(isKnownPath)) return json({ error: "unknown_path" }, 400, correlationId);

  const tags = [...new Set(event.tags)];
  // The sitemap index names its children (ADR-043): refresh and warm them with it.
  const paths = withSitemapChildren(event.paths);
  if (event.kind === "publish") {
    // Pages are stale-while-revalidate ("max") and warmed. The sitemap read is expired at once:
    // the proxy lookup checks slugs against it, so a stale sitemap would answer a just-published
    // post as missing (DECISIONS 109). It is one small read, shared across instances.
    for (const tag of tags) deps.revalidateTag(tag, tag === "sitemap" ? { expire: 0 } : "max");
    if (paths.length > 0) deps.warm(paths);
  } else {
    for (const tag of tags) deps.revalidateTag(tag, { expire: 0 });
    for (const path of paths) deps.revalidatePath(path);
  }
  deps.clearLookupVerdicts();
  const pages = indexNowPaths(paths);
  if (pages.length > 0) deps.notifyIndexNow?.(pages);

  deps.logger?.info("content.revalidated", {
    correlationId,
    eventId: event.eventId,
    kind: event.kind,
    keyId: verified.keyId,
    tags: tags.length,
    paths: paths.length,
  });
  return json({ revalidated: tags }, 200, correlationId);
}

/**
 * The paths of an event worth an IndexNow ping: Insights and Careers pages (published, changed or
 * removed alike). Feeds, sitemaps and the homepage are left out; the deploy workflow pings those.
 */
export function indexNowPaths(paths: readonly string[]): string[] {
  return paths.filter(
    (path) =>
      (path === "/insights" ||
        path.startsWith("/insights/") ||
        path === "/careers" ||
        path.startsWith("/careers/")) &&
      !path.endsWith(".xml"),
  );
}

/**
 * Warms paths with server-side GETs to the site's own origin: bounded concurrency, a short
 * timeout per request, and it never throws (a failed warm only means the next visitor renders).
 */
export async function warmPaths(
  origin: string,
  paths: readonly string[],
  options: { fetch?: typeof fetch; concurrency?: number; timeoutMs?: number } = {},
): Promise<{ warmed: number; failed: number }> {
  const fetchImpl = options.fetch ?? fetch;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const timeoutMs = options.timeoutMs ?? 8_000;
  const queue = [...paths];
  let warmed = 0;
  let failed = 0;
  const worker = async () => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      try {
        const response = await fetchImpl(new URL(path, origin), {
          headers: { "x-vitalos-warm": "1" },
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
        await response.body?.cancel().catch(() => undefined);
        if (response.ok) warmed += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));
  return { warmed, failed };
}
