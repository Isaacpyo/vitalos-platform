/**
 * Protects the admin from random-slug amplification (security review, item 1).
 *
 * Every unique `/insights/<random>` or `/careers/<random>` would otherwise cost one signed admin
 * read (a new cache key each time). The lookup therefore checks a slug against the paths of the
 * cached `sitemap` read first. A path the sitemap does not list is usually unknown, but it may be
 * an old slug (308), a closed role (its page stays up) or something published seconds ago (the
 * `sitemap` tag is refreshed by the publish event, stale-while-revalidate). Those are confirmed with
 * a real read, at most `perMinute` times a minute per instance; a confirmed real path is
 * remembered so it never needs the budget again. Once the budget is spent, unlisted paths answer
 * "missing" until the next minute.
 */
export interface SlugGuardOptions {
  /** Confirm reads allowed per minute per instance for paths the sitemap does not list. */
  perMinute?: number;
  /** Real-but-unlisted paths remembered (old slugs, closed roles), oldest dropped first. */
  maxRemembered?: number;
  now?: () => number;
}

export function createSlugGuard(options: SlugGuardOptions = {}) {
  const perMinute = options.perMinute ?? 30;
  const maxRemembered = options.maxRemembered ?? 1000;
  const now = options.now ?? Date.now;
  const remembered = new Set<string>();
  let windowStart = 0;
  let used = 0;

  return {
    /** Takes one confirm read from this minute's budget; false when it is spent. */
    allowConfirm(): boolean {
      const minute = Math.floor(now() / 60_000);
      if (minute !== windowStart) {
        windowStart = minute;
        used = 0;
      }
      if (used >= perMinute) return false;
      used += 1;
      return true;
    },
    /** A path the admin confirmed as real although the sitemap does not list it. */
    remember(path: string): void {
      remembered.delete(path);
      remembered.add(path);
      while (remembered.size > maxRemembered) {
        const oldest = remembered.values().next().value;
        if (oldest === undefined) break;
        remembered.delete(oldest);
      }
    },
    isRemembered: (path: string): boolean => remembered.has(path),
    /** Forget everything (after a revalidation on this instance, and in tests). */
    reset(): void {
      remembered.clear();
      used = 0;
    },
  };
}

export type SlugGuard = ReturnType<typeof createSlugGuard>;
