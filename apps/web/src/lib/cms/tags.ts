/**
 * Cache tags for Sanity reads (ADR-018). Every Sanity read carries the root tag, so a single
 * `revalidateTag(CMS_ROOT_TAG)` refreshes the whole site, plus finer tags for the document type
 * and slug the webhook reports. Tags are case-sensitive and limited to 256 characters by
 * Next.js; a longer tag is silently never assigned, so oversized tags are dropped here.
 */
export const CMS_ROOT_TAG = "sanity";
export const MAX_TAG_LENGTH = 256;

const safePart = /^[A-Za-z0-9._-]+$/;

export const typeTag = (type: string): string => `${CMS_ROOT_TAG}:${type}`;
export const documentTag = (type: string, slug: string): string =>
  `${CMS_ROOT_TAG}:${type}:${slug}`;

/** Root tag first, then the unique valid tags in the order given. */
export function normaliseTags(tags: readonly string[] = []): string[] {
  const out = new Set<string>([CMS_ROOT_TAG]);
  for (const tag of tags) {
    if (tag.length > 0 && tag.length <= MAX_TAG_LENGTH) out.add(tag);
  }
  return [...out];
}

/**
 * Tags to invalidate for a webhook payload. Always includes the root tag so that list pages,
 * publication gates, the sitemap and the home page refresh whatever the document type was.
 * Type and slug are only used when they are plain identifiers (never echoed into a tag raw).
 */
export function tagsForDocument(type: unknown, slug: unknown): string[] {
  const tags: string[] = [CMS_ROOT_TAG];
  if (typeof type === "string" && safePart.test(type)) {
    tags.push(typeTag(type));
    if (typeof slug === "string" && safePart.test(slug)) tags.push(documentTag(type, slug));
  }
  return normaliseTags(tags);
}
