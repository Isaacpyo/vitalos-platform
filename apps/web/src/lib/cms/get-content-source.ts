import "server-only";
import { getEnv } from "@vitalos/config";
import type { ContentSource } from "@vitalos/cms";
import { resolveContentSource } from "./content-source-factory";
import type { ContentSourceConfig, ContentSourceLoaders } from "./content-source-factory";

/**
 * Entry point for every page, route and metadata function that needs content (ADR-028).
 *
 *   const source = await getContentSource();
 *   const practice = await source.getDocument("practice", slug);
 *
 * Content is static per deploy: the source is built once per process and reads are never
 * revalidated by an external event.
 */

const loaders: ContentSourceLoaders = {
  loadFixturesModule: () =>
    import("@vitalos/cms/fixtures") as unknown as Promise<Record<string, unknown>>,
  loadDraftModule: () =>
    import("@vitalos/cms/draft") as unknown as Promise<Record<string, unknown>>,
  loadRepoModule: () => import("@vitalos/cms/repo") as unknown as Promise<Record<string, unknown>>,
  warn: (message) => console.warn(message),
};

function readConfig(): ContentSourceConfig {
  const env = getEnv();
  return {
    kind: env.contentSource,
    deployEnv: env.deployEnv,
    fixtureSet: env.fixtureSet,
  };
}

let cached: Promise<ContentSource> | undefined;

function load(): Promise<ContentSource> {
  const pending = (cached ??= resolveContentSource(readConfig(), loaders));
  // A failed load must not poison the process: retry on the next call.
  pending.catch(() => {
    if (cached === pending) cached = undefined;
  });
  return pending;
}

export function getContentSource(): Promise<ContentSource> {
  return load();
}

/** Test hook: forget the memoised source. */
export function resetContentSourceCache(): void {
  cached = undefined;
}
