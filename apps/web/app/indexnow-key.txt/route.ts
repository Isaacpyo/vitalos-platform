import { headers } from "next/headers";
import { getEnv } from "@vitalos/config";
import { getSeoContext } from "../../src/features/seo/context";
import { isIndexableRequest } from "../../src/features/seo/site";

/**
 * The IndexNow key file (docs/seo/DECISIONS.md 14), public by design: search engines fetch it to
 * check that a ping really comes from this site. Served only on the canonical host of production,
 * and only when `INDEXNOW_KEY` is set; everywhere else it is a 404.
 */
export async function GET(): Promise<Response> {
  const key = getEnv().search.indexNowKey;
  const host = (await headers()).get("host");
  if (!key || !isIndexableRequest(getSeoContext(), host)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(key, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
