import type { Logger } from "@vitalos/observability";
import type { RateLimiter } from "@vitalos/security/rate-limit";
import { ContentUnavailableError } from "../client";
import type { ContentReaders } from "../readers";
import { postPath, rolePath } from "../routes";
import { verifyPreviewToken } from "../signing";
import type { SigningKey } from "../signing";
import { correlationIdFrom, json, rateLimited } from "./guards";

/** HttpOnly cookie that keeps the preview token for Draft Mode reads (brief A5). */
export const PREVIEW_COOKIE = "vitalos_preview";

const previewHeaders = (correlationId: string): Record<string, string> => ({
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex",
  "x-request-id": correlationId,
});

export function previewCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  return [
    `${PREVIEW_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export interface EnterPreviewDeps {
  /** `CONTENT_PREVIEW_SECRET` keys; empty means not configured (503). */
  keys: readonly SigningKey[];
  limiter: RateLimiter;
  readers: Pick<ContentReaders, "readPreview">;
  enableDraftMode(): Promise<void>;
  /** False only for plain-http local runs. */
  secureCookies: boolean;
  logger?: Pick<Logger, "info" | "warn">;
  /** Unix seconds. */
  now?: () => number;
}

/**
 * `GET /api/content/preview?token=…` (brief 3.6, A5): verifies the admin's preview token, asks the
 * admin for the working copy (previews are by id, so this also finds the path for an unpublished
 * item), enables Draft Mode, keeps the token in an HttpOnly, SameSite=Lax cookie that expires with
 * the token, and redirects (307) to the item's page. `noindex` and `private, no-store` throughout.
 */
export async function handleEnterPreview(
  request: Request,
  deps: EnterPreviewDeps,
): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  const headers = previewHeaders(correlationId);
  const limited = await rateLimited(deps.limiter, request.headers, "preview", correlationId);
  if (limited) return limited;
  if (deps.keys.length === 0) return json({ error: "unavailable" }, 503, correlationId, headers);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const now = deps.now?.() ?? Math.floor(Date.now() / 1000);
  const verified = verifyPreviewToken(token, deps.keys, now);
  if (!verified.ok) {
    deps.logger?.warn("content.preview.refused", { correlationId, reason: verified.reason });
    return json({ error: "unauthorized" }, 401, correlationId, headers);
  }
  const { entity, id, exp } = verified.payload;

  let slug: string | undefined;
  try {
    const result = await deps.readers.readPreview(entity, id, token);
    if (result.kind === "ok") {
      slug = entity === "post" ? result.data.post?.slug : result.data.role?.slug;
    }
  } catch (error) {
    if (error instanceof ContentUnavailableError) {
      return json({ error: "unavailable" }, 503, correlationId, headers);
    }
    throw error;
  }
  if (!slug) return json({ error: "not_found" }, 404, correlationId, headers);

  await deps.enableDraftMode();
  deps.logger?.info("content.preview.entered", { correlationId, entity, id });
  return new Response(null, {
    status: 307,
    headers: {
      ...headers,
      location: entity === "post" ? postPath(slug) : rolePath(slug),
      "set-cookie": previewCookie(token, exp - now, deps.secureCookies),
    },
  });
}

export interface ExitPreviewDeps {
  limiter: RateLimiter;
  disableDraftMode(): Promise<void>;
  secureCookies: boolean;
}

/** A same-site relative path (`/…`, never `//…` or a backslash trick), else the homepage. */
export function safeReturnPath(value: string | null): string {
  if (!value || value.length > 200) return "/";
  return /^\/(?![/\\])[^\\\s]*$/.test(value) ? value : "/";
}

/** `GET /api/content/preview/exit?path=…`: leaves Draft Mode and returns to a relative path. */
export async function handleExitPreview(
  request: Request,
  deps: ExitPreviewDeps,
): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  const limited = await rateLimited(deps.limiter, request.headers, "preview", correlationId);
  if (limited) return limited;
  await deps.disableDraftMode();
  return new Response(null, {
    status: 307,
    headers: {
      ...previewHeaders(correlationId),
      location: safeReturnPath(new URL(request.url).searchParams.get("path")),
      "set-cookie": previewCookie("", 0, deps.secureCookies),
    },
  });
}
