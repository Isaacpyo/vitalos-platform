import "server-only";
import { unstable_cache } from "next/cache";
import { getEnv } from "@vitalos/config";
import { createLogger } from "@vitalos/observability";
import { createContentClient } from "./client";
import type { ContentClient } from "./client";
import { createReaders } from "./readers";
import type { CacheFunction, ContentReaders } from "./readers";

/**
 * Composition root for the content feature: wires the client and the cached readers to the
 * validated environment. The only module here that touches `next/cache` and `@vitalos/config`.
 */

let client: ContentClient | null | undefined;
let readers: ContentReaders | undefined;

/** The signed client, or null when `CONTENT_API_BASE_URL` (and the read key) are not set. */
export function getContentClient(): ContentClient | null {
  if (client !== undefined) return client;
  const env = getEnv();
  const { apiBaseUrl, readKey, submitKey } = env.content;
  client =
    apiBaseUrl && readKey
      ? createContentClient({
          baseUrl: apiBaseUrl,
          readKey,
          submitKey,
          logger: createLogger({ service: "vitalos-web", env: env.deployEnv }),
        })
      : null;
  return client;
}

const cache: CacheFunction = (fn, keyParts, options) => unstable_cache(fn, keyParts, options);

/** The cached readers the pages, the proxy lookup and the tick route all share. */
export function getContentReaders(): ContentReaders {
  readers ??= createReaders({
    client: getContentClient(),
    cache,
    ttlSeconds: getEnv().content.cacheTtlSeconds,
  });
  return readers;
}
