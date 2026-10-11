/**
 * Parameters every public query takes. Kept free of `groq` so mappers and fixtures can use them.
 */

/** Editorial statuses a published read may show. `archived` and everything in progress is excluded. */
export const publicEditorialStatuses = ["approved"] as const;

/**
 * Statuses a draft-mode read may show: work in progress is visible to editors previewing, but
 * `archived` never is.
 */
export const previewEditorialStatuses = ["approved", "needs-review", "review", "draft"] as const;

export interface QueryParams {
  statuses: readonly string[];
  /** YYYY-MM-DD in UTC; the reference date for expiry checks. */
  today: string;
  [param: string]: unknown;
}

export function statusesFor(preview: boolean | undefined): readonly string[] {
  return preview ? previewEditorialStatuses : publicEditorialStatuses;
}

/** UTC calendar date of `now` as YYYY-MM-DD. */
export function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Cache tags for a read, following the web app's scheme (ADR-018): `sanity:<type>` for everything
 * of a document type and `sanity:<type>:<slug>` for one document. The fetcher adds the root tag.
 * The Sanity webhook reports `{ _type, slug }`, so these match what it invalidates.
 */
export const cmsTypeTag = (type: string): string => `sanity:${type}`;
export const cmsDocumentTag = (type: string, slug: string): string => `sanity:${type}:${slug}`;
