import tagsJson from "../../../../../contracts/content-api/v1/tags.json";

/**
 * Cache tags and path patterns from the contract (`contracts/content-api/v1/tags.json`, ADR-036).
 * The JSON is imported, not copied, so the readers' tags and the revalidate route's validation
 * cannot drift from what the admin emits. Pure: no framework imports.
 */

/** The read endpoints that carry tags, as named in `tags.json` `reads`. */
export const readNames = [
  "site-state",
  "insights/posts",
  "insights/posts/{slug}",
  "insights/authors/{slug}",
  "insights/topics",
  "insights/topics/{slug}",
  "insights/feed",
  "careers/page",
  "careers/roles/{slug}",
  "home",
  "sitemap",
] as const;
export type ReadName = (typeof readNames)[number];

export const tagsContract: {
  version: number;
  tagPattern: string;
  tags: Record<string, { pattern: string; description: string }>;
  reads: Record<string, string[]>;
  pathPatterns: string[];
} = tagsJson;

const tagPattern = new RegExp(tagsContract.tagPattern);
const knownTagPatterns = Object.values(tagsContract.tags).map((tag) => new RegExp(tag.pattern));
const pathPatterns = tagsContract.pathPatterns.map((pattern) => new RegExp(pattern));
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The exact tags a read carries, from `tags.json`, with `{slug}` filled in. Throws on an unknown
 * read or a slug that is not a contract slug (a programming error, never user input).
 */
export function tagsForRead(read: ReadName, params: { slug?: string } = {}): string[] {
  const templates = tagsContract.reads[read];
  if (!templates) throw new Error(`Unknown content read: ${read}`);
  return templates.map((template) => {
    if (!template.includes("{slug}")) return template;
    const slug = params.slug;
    if (slug === undefined || slug.length > 80 || !slugPattern.test(slug)) {
      throw new Error(`Read ${read} needs a valid slug for its tags`);
    }
    return template.replace("{slug}", slug);
  });
}

/** A tag the website caches under: matches `tagPattern` and one of the named tag patterns. */
export function isKnownTag(tag: string): boolean {
  return tag.length <= 200 && tagPattern.test(tag) && knownTagPatterns.some((p) => p.test(tag));
}

/** A path the admin may ask the website to revalidate or warm: one of `pathPatterns`. */
export function isKnownPath(path: string): boolean {
  return path.length <= 200 && pathPatterns.some((pattern) => pattern.test(path));
}
