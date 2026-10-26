import "server-only";
import type { PostSummaryData } from "./schemas";
import { getContentReaders } from "./server";
import { getSiteStateOrClosed } from "./site-state";

type Readers = Pick<ReturnType<typeof getContentReaders>, "topic" | "post">;

/**
 * The latest published posts of an Insights topic or sector, newest first, for a lead page's
 * Insights block (Website Build Pack, 25 Oct 2026). Fail-soft like the homepage sections
 * (ADR-040): Insights closed, the admin not configured or unreachable, or the topic missing all
 * leave the block out, so the page never errors because of the admin.
 */
export async function loadLatestTopicPosts(
  topicSlug: string,
  limit = 3,
  readers: Readers = getContentReaders(),
): Promise<PostSummaryData[]> {
  try {
    const state = await getSiteStateOrClosed();
    if (!state.insightsOpen) return [];
    const result = await readers.topic(topicSlug, 1);
    if (result.kind !== "ok") return [];
    const { featured, items } = result.data.posts;
    return [...(featured ? [featured] : []), ...items].slice(0, limit);
  } catch {
    return [];
  }
}

/** Whether a post is published under this slug (not a redirect). False on any failure. */
export async function isInsightPublished(
  slug: string,
  readers: Readers = getContentReaders(),
): Promise<boolean> {
  try {
    const state = await getSiteStateOrClosed();
    if (!state.insightsOpen) return false;
    const result = await readers.post(slug);
    return result.kind === "ok" && !("redirect" in result.data);
  } catch {
    return false;
  }
}
