import type { DocKind } from "@vitalos/cms";
import { matchDetailRoute, routeKey } from "./detail-routes";

export interface MissingDocumentCheckerDeps {
  /** `ContentSource.listParams` of the PUBLISHED source. */
  listParams(kind: DocKind): Promise<Record<string, string>[]>;
  /** How long a kind's list is trusted for "this document exists". */
  ttlMs?: number;
  /** A cached "missing" older than this is confirmed by a fresh read before it becomes a 404. */
  confirmMs?: number;
  /** Upper bound for one `listParams` read; beyond it the check fails open. */
  timeoutMs?: number;
  /** After a failed or timed-out read, how long before the next attempt (stale entry served). */
  failureTtlMs?: number;
  now?: () => number;
}

export const DEFAULT_TTL_MS = 30_000;
export const DEFAULT_CONFIRM_MS = 3_000;
export const DEFAULT_TIMEOUT_MS = 1_500;
export const DEFAULT_FAILURE_TTL_MS = 5_000;

interface Entry {
  at: number;
  keys: Set<string>;
}

/** Every key a params record is known by: the full match, and (for labs) the type alone. */
function keysOf(params: Record<string, string>): string[] {
  const keys: string[] = [];
  if (params["slug"] !== undefined && params["type"] === undefined) {
    keys.push(routeKey(["slug"], [params["slug"]]));
  }
  if (params["topic"] !== undefined) keys.push(routeKey(["topic"], [params["topic"]]));
  if (params["type"] !== undefined) {
    keys.push(routeKey(["type"], [params["type"]]));
    if (params["slug"] !== undefined) {
      keys.push(routeKey(["type", "slug"], [params["type"], params["slug"]]));
    }
  }
  return keys;
}

/**
 * Decides, from the published document list alone, that a detail URL has no document behind it.
 *
 * Why this exists (ADR-026): Next.js cannot server-render the not-found UI for a `notFound()`
 * thrown by a page. The shell render fails, Next sends an empty `__next_error__` document with
 * status 404 and the browser draws the 404 from the streamed payload, so a visitor without
 * JavaScript sees a blank page. An unmatched URL, in contrast, is server-rendered. The proxy
 * therefore rewrites a request that is certain to be a 404 onto an unmatched URL.
 *
 * Conservative by construction: it only ever answers "missing" when the list for the kind was
 * read successfully and does not contain the document. Any failure, any path that is not a detail
 * route and anything the page would still have to decide (closed gates, unverified proof) answers
 * "not missing", and the page keeps its own `notFound()`.
 *
 * The list is cached per kind for `ttlMs`; a cached "missing" older than `confirmMs` is re-read
 * before it can become a 404, so a document published through another instance is not hidden for
 * the whole window. Reads are bounded by `timeoutMs` and fail open; a failure is remembered for
 * `failureTtlMs` so a slow source cannot stall every request.
 */
export function createMissingDocumentChecker(deps: MissingDocumentCheckerDeps) {
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const confirmMs = deps.confirmMs ?? DEFAULT_CONFIRM_MS;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const failureTtlMs = deps.failureTtlMs ?? DEFAULT_FAILURE_TTL_MS;
  const now = deps.now ?? Date.now;
  const cache = new Map<DocKind, Entry>();
  const failedUntil = new Map<DocKind, number>();
  const inFlight = new Map<DocKind, Promise<Entry | null>>();

  /** One bounded read. Resolves to null on failure or timeout; a failure is remembered briefly. */
  function refresh(kind: DocKind): Promise<Entry | null> {
    const pending = inFlight.get(kind);
    if (pending) return pending;
    const started = (async (): Promise<Entry | null> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const params = await Promise.race([
          deps.listParams(kind),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
          }),
        ]);
        const entry: Entry = { at: now(), keys: new Set(params.flatMap(keysOf)) };
        cache.set(kind, entry);
        failedUntil.delete(kind);
        return entry;
      } catch {
        failedUntil.set(kind, now() + failureTtlMs);
        return null;
      } finally {
        clearTimeout(timer);
        inFlight.delete(kind);
      }
    })();
    inFlight.set(kind, started);
    return started;
  }

  /** Fresh entry, else a read; during a recent failure the stale entry (or null) is served. */
  async function load(kind: DocKind): Promise<Entry | null> {
    const cached = cache.get(kind);
    if (cached && now() - cached.at < ttlMs) return cached;
    if ((failedUntil.get(kind) ?? 0) > now()) return cached ?? null;
    return (await refresh(kind)) ?? cached ?? null;
  }

  return {
    async isMissing(pathname: string): Promise<boolean> {
      const route = matchDetailRoute(pathname);
      if (!route) return false;
      const key = routeKey(route.fields, route.values);
      let entry = await load(route.kind);
      if (!entry || entry.keys.has(key)) return false;
      // A cached "missing" is never trusted on its own: another instance may have seen a
      // revalidation this one has not. Confirm against a read that is at most `confirmMs` old
      // (one shared read per kind per window, so random slugs cannot multiply reads).
      if (now() - entry.at > confirmMs) {
        const fresh = await refresh(route.kind);
        if (!fresh) return false;
        entry = fresh;
      }
      return !entry.keys.has(key);
    },
    /** Forget cached lists (after a content revalidation, and in tests). */
    reset(): void {
      cache.clear();
      failedUntil.clear();
    },
  };
}

export type MissingDocumentChecker = ReturnType<typeof createMissingDocumentChecker>;
