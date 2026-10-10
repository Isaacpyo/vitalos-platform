import "server-only";
import { getEnv } from "@vitalos/config";
import type { ContentSource } from "@vitalos/cms";
import { resolveContentSource } from "./content-source-factory";
import type { ContentSourceConfig, ContentSourceLoaders } from "./content-source-factory";
import { DraftAwareContentSource, publishedOnly } from "./draft-aware-source";
import type { PreviewResolver } from "./draft-aware-source";
import { isDraftModeEnabled } from "./draft";

/**
 * Entry point for every page, route and metadata function that needs content (ADR-018).
 *
 *   const source = await getContentSource();
 *   const practice = await source.getDocument("practice", slug);   // draft for editors only
 *
 * `getContentSource()` is draft-aware: when Draft Mode is on and a read token is configured,
 * reads use the `drafts` perspective and bypass the cache; for everyone else they are published
 * and tag-cached. `getPublishedContentSource()` is for the sitemap, `generateStaticParams` and
 * anything else that must never see drafts.
 */

const loaders: ContentSourceLoaders = {
  async createSanityFetcher(connection) {
    const { createSanityFetcherFor } = await import("./client");
    return createSanityFetcherFor(connection);
  },
  loadQueriesModule: () =>
    import("@vitalos/cms/queries") as unknown as Promise<Record<string, unknown>>,
  loadFixturesModule: () =>
    import("@vitalos/cms/fixtures") as unknown as Promise<Record<string, unknown>>,
  warn: (message) => console.warn(message),
};

function readConfig(): ContentSourceConfig {
  const env = getEnv();
  return {
    kind: env.contentSource,
    deployEnv: env.deployEnv,
    fixtureSet: env.fixtureSet,
    sanity: {
      projectId: env.sanity.projectId,
      dataset: env.sanity.dataset,
      apiVersion: env.sanity.apiVersion,
      readToken: env.sanity.readToken,
    },
  };
}

let cached: Promise<{ source: ContentSource; canPreview: boolean }> | undefined;

function load() {
  cached ??= (async () => {
    const config = readConfig();
    const source = await resolveContentSource(config, loaders);
    return { source, canPreview: config.kind === "sanity" && Boolean(config.sanity.readToken) };
  })();
  // A failed load must not poison the process: retry on the next call.
  cached.catch(() => {
    cached = undefined;
  });
  return cached;
}

/** Draft Mode previews only when the request really has Draft Mode enabled. */
function draftResolver(canPreview: boolean): PreviewResolver {
  return async (explicit) => {
    if (explicit === false || !canPreview) return false;
    return isDraftModeEnabled();
  };
}

export async function getContentSource(): Promise<ContentSource> {
  const { source, canPreview } = await load();
  return new DraftAwareContentSource(source, draftResolver(canPreview));
}

export async function getPublishedContentSource(): Promise<ContentSource> {
  const { source } = await load();
  return new DraftAwareContentSource(source, publishedOnly);
}

/** Test hook: forget the memoised source. */
export function resetContentSourceCache(): void {
  cached = undefined;
}
