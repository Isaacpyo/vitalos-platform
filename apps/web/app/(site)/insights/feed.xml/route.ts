import { getEnv } from "@vitalos/config";
import { buildRss } from "../../../../src/features/content/insights/model";
import { getContentReaders } from "../../../../src/features/content/server";
import { getSiteState } from "../../../../src/features/content/site-state";

/**
 * `/insights/feed.xml` (brief 5.3): RSS 2.0, the newest 20 published posts, tagged `feed` through
 * the cached reader. Closed or unconfigured: 404.
 */
/** Static, refreshed through the `feed` tag and the TTL like the pages. */
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const notFound = () =>
    new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  const state = await getSiteState();
  if (!state.insightsOpen) return notFound();
  const feed = await getContentReaders().feed();
  if (feed.kind === "missing") return notFound();
  return new Response(
    buildRss(feed.data, { siteUrl: getEnv().siteUrl, description: state.insights.intro }),
    { headers: { "content-type": "application/rss+xml; charset=utf-8" } },
  );
}
