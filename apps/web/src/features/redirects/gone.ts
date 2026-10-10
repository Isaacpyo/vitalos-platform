import { redirectMap } from "./redirect-map";
import type { RedirectRule } from "./types";

/**
 * Permanently removed paths answer `410 Gone` from the proxy (Stage 10 §12: retired URLs are
 * gone, not silently redirected to unrelated pages). Rules come from the same redirect map as
 * the 301/308 redirects (`status: 410`). No rules exist until the owner approves some.
 */

const normalise = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

export function goneSet(rules: readonly RedirectRule[] = redirectMap): ReadonlySet<string> {
  return new Set(rules.filter((rule) => rule.status === 410).map((rule) => rule.source));
}

const defaultSet = goneSet();

export function isGone(pathname: string, gone: ReadonlySet<string> = defaultSet): boolean {
  return gone.has(normalise(pathname));
}

/** A bare 410. Not cached by shared caches for long, so un-gone paths recover quickly. */
export function goneResponse(): Response {
  return new Response("Gone", {
    status: 410,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
