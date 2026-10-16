/**
 * IndexNow (docs/seo/DECISIONS.md 14): tells Bing, Yandex, Seznam, Naver and the other
 * participating engines that URLs were added, changed or removed, so they recrawl sooner. Google
 * does not use IndexNow.
 *
 * The key is public by design: it is served at `/indexnow-key.txt` (the `keyLocation`) on the
 * canonical host, and the ping proves ownership by naming that location. Only canonical-host URLs
 * are sent, at most 10,000 per request (the protocol limit).
 *
 * Callers: the deploy workflow (`tooling/seo/indexnow-deploy.mjs`, after each production
 * deployment) and, once Insights and Careers publish from the Super Admin (PR #46), its revalidation
 * outbox on publish, update and removal.
 */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_PATH = "/indexnow-key.txt";
const MAX_URLS = 10_000;

export interface IndexNowPing {
  /** Canonical origin, for example `https://vitalos.co.uk`. */
  siteUrl: string;
  key: string;
  urls: readonly string[];
}

/** The request bodies to send: canonical-host URLs only, deduplicated, in chunks of 10,000. */
export function indexNowBodies(ping: IndexNowPing): Record<string, unknown>[] {
  const site = new URL(ping.siteUrl);
  const urls = [
    ...new Set(ping.urls.filter((url) => URL.canParse(url) && new URL(url).host === site.host)),
  ];
  const bodies: Record<string, unknown>[] = [];
  for (let i = 0; i < urls.length; i += MAX_URLS) {
    bodies.push({
      host: site.host,
      key: ping.key,
      keyLocation: new URL(INDEXNOW_KEY_PATH, site).toString(),
      urlList: urls.slice(i, i + MAX_URLS),
    });
  }
  return bodies;
}

/**
 * Sends the ping. Returns the HTTP statuses (200 and 202 mean accepted). Never throws: a failed
 * ping only delays recrawling, so it must not fail a publish or a deploy.
 */
export async function submitIndexNow(
  ping: IndexNowPing,
  fetchImpl: typeof fetch = fetch,
): Promise<number[]> {
  const statuses: number[] = [];
  for (const body of indexNowBodies(ping)) {
    try {
      const response = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      statuses.push(response.status);
    } catch {
      statuses.push(0);
    }
  }
  return statuses;
}
