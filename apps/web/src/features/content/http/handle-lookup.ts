import type { RateLimiter } from "@vitalos/security/rate-limit";
import { LOOKUP_AUTH_HEADER, LOOKUP_CLIENT_IP_HEADER, verifyLookup } from "../lookup/auth";
import type { SlugGuard } from "../lookup/slug-guard";
import { lookupVerdict, matchContentRoute } from "../lookup/verdict";
import type { ContentReaders } from "../readers";
import { correlationIdFrom, json, rateLimited } from "./guards";

export interface LookupDeps {
  /** `CONTENT_READ_SECRET`, from which the lookup key is derived; undefined when not configured. */
  readSecret: string | undefined;
  limiter: RateLimiter;
  readers: ContentReaders;
  /** Caps admin reads for slugs the sitemap does not list (per instance). */
  guard?: SlugGuard;
  /** Unix seconds. */
  now?: () => number;
}

/**
 * `GET /api/content/lookup?path=…`: the proxy's internal question "what is this Insights or
 * Careers path?" (ADR-040), answered with the pages' own cached readers. Only the proxy can call
 * it: the `x-vitalos-lookup` header is an HMAC of the path under a key derived from the read
 * secret (see `lookup/auth.ts`). Anything else is 404, so the route reveals nothing. The limiter
 * keys on the visitor's address the proxy signed into the request, never on the proxy's own.
 */
export async function handleLookupRequest(request: Request, deps: LookupDeps): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const clientIp = (request.headers.get(LOOKUP_CLIENT_IP_HEADER) ?? "").slice(0, 45);
  const authorised = verifyLookup(
    deps.readSecret,
    request.headers.get(LOOKUP_AUTH_HEADER),
    { path, clientIp },
    deps.now?.(),
  );
  if (!authorised) return json({ error: "not_found" }, 404, correlationId);
  const limited = await rateLimited(
    deps.limiter,
    request.headers,
    clientIp ? "lookup" : "lookup-anonymous",
    correlationId,
    { error: "rate_limited" },
    clientIp || "unknown-visitor",
  );
  if (limited) return limited;
  if (!matchContentRoute(path)) return json({ error: "invalid" }, 400, correlationId);
  return json(await lookupVerdict(path, deps.readers, deps.guard), 200, correlationId);
}
