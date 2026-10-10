import { normaliseTags } from "./tags";

/**
 * The single seam between Sanity reads and the Next.js cache (ADR-018).
 *
 * Caching model: tag-based ISR through the data cache. Published reads are `force-cache` with
 * tags, invalidated by the signed Sanity webhook (`/api/revalidate`), with a time-based safety
 * net so a missed webhook can never leave content stale for longer than `REVALIDATE_SECONDS`.
 * Draft reads (Draft Mode with a read token) are never cached.
 *
 * Moving to Cache Components later changes only this file: replace the published branch with a
 * `'use cache'` function that calls `cacheTag(...tags)` and `cacheLife(...)`.
 */

/** Upper bound for staleness when no webhook arrives. One hour. */
export const REVALIDATE_SECONDS = 3600;

export interface SanityFetchOptions {
  /** Extra cache tags. The root tag is always added. */
  tags?: readonly string[];
  /** Read drafts (needs a configured draft client). Never cached. */
  preview?: boolean;
}

/** Fetcher injected into `createSanityContentSource(fetcher)` (workstream C2). */
export type SanityFetcher = <T = unknown>(
  query: string,
  params?: Record<string, unknown>,
  options?: SanityFetchOptions,
) => Promise<T>;

/** The slice of `@sanity/client` the fetcher needs; lets tests inject a fake. */
export interface SanityClientLike {
  fetch(
    query: string,
    params: Record<string, unknown>,
    options: { cache?: RequestCache; next?: { tags?: string[]; revalidate?: number | false } },
  ): Promise<unknown>;
}

export interface SanityFetcherDeps {
  published: SanityClientLike;
  /** Present only when a read token is configured. Without it preview requests read published. */
  draft?: SanityClientLike;
  revalidateSeconds?: number;
}

export function createSanityFetcher(deps: SanityFetcherDeps): SanityFetcher {
  const revalidate = deps.revalidateSeconds ?? REVALIDATE_SECONDS;
  return async function fetchSanity<T>(
    query: string,
    params: Record<string, unknown> = {},
    options: SanityFetchOptions = {},
  ): Promise<T> {
    if (options.preview && deps.draft) {
      return (await deps.draft.fetch(query, params, { cache: "no-store" })) as T;
    }
    return (await deps.published.fetch(query, params, {
      cache: "force-cache",
      next: { tags: normaliseTags(options.tags), revalidate },
    })) as T;
  };
}
