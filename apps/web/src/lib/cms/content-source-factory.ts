import { EmptyContentSource } from "@vitalos/cms";
import type { ContentSource } from "@vitalos/cms";
import type { ContentSourceKind, FixtureSet } from "@vitalos/config";
import type { SanityFetcher } from "./fetch";

/**
 * Chooses the `ContentSource` implementation (ADR-018). Pure selection logic: all I/O (Sanity
 * client, dynamic imports) sits behind injectable loaders so it is unit-testable.
 *
 * Extension point: add a kind to `contentSourceFactories` (or pass a replacement map to
 * `resolveContentSource`). Each factory receives the validated configuration and returns a
 * `ContentSource`. The platform builds and runs with `empty`, which is the honest empty state.
 */

export interface SanityConnectionConfig {
  projectId: string | undefined;
  dataset: string;
  apiVersion: string;
  readToken?: string | undefined;
}

export interface ContentSourceConfig {
  kind: ContentSourceKind;
  deployEnv: string;
  fixtureSet: FixtureSet;
  sanity: SanityConnectionConfig;
}

export interface ContentSourceLoaders {
  /** Creates the Sanity fetcher (server-only client). */
  createSanityFetcher(connection: {
    projectId: string;
    dataset: string;
    apiVersion: string;
    readToken?: string | undefined;
  }): Promise<SanityFetcher>;
  /** Module that exports `createSanityContentSource(fetcher)` (workstream C2). */
  loadQueriesModule(): Promise<Record<string, unknown>>;
  /** Module that exports `createFixtureContentSource(set)` (workstream C2). */
  loadFixturesModule(): Promise<Record<string, unknown>>;
  warn(message: string): void;
}

export type ContentSourceFactory = (
  config: ContentSourceConfig,
  loaders: ContentSourceLoaders,
) => Promise<ContentSource>;

const emptyFactory: ContentSourceFactory = () => Promise.resolve(new EmptyContentSource());

/**
 * Sanity needs a project id and the C2 source module. When the module is missing the factory
 * fails loudly: silently serving an empty site when Sanity was asked for would be dishonest.
 */
const sanityFactory: ContentSourceFactory = async (config, loaders) => {
  const { projectId, dataset, apiVersion, readToken } = config.sanity;
  if (!projectId) {
    throw new Error(
      "VITALOS_CONTENT_SOURCE is sanity but NEXT_PUBLIC_SANITY_PROJECT_ID is not set.",
    );
  }
  const queries = await loaders.loadQueriesModule();
  const create = queries["createSanityContentSource"];
  if (typeof create !== "function") {
    throw new Error(
      "The Sanity content source is not available: @vitalos/cms/queries does not export createSanityContentSource (workstream C2).",
    );
  }
  const fetcher = await loaders.createSanityFetcher({ projectId, dataset, apiVersion, readToken });
  return (create as (f: SanityFetcher) => ContentSource)(fetcher);
};

/**
 * Fixtures (artificial content, never production). Until workstream C2 exports
 * `createFixtureContentSource`, fall back to the empty source with a warning so builds and
 * e2e runs configured with fixtures keep working.
 */
const fixturesFactory: ContentSourceFactory = async (config, loaders) => {
  if (config.deployEnv === "production") {
    throw new Error("The fixtures content source is forbidden in production.");
  }
  const mod = await loaders.loadFixturesModule();
  const create = mod["createFixtureContentSource"];
  if (typeof create !== "function") {
    loaders.warn(
      "VITALOS_CONTENT_SOURCE is fixtures but @vitalos/cms/fixtures has no createFixtureContentSource yet; using the empty content source.",
    );
    return new EmptyContentSource();
  }
  return (create as (set: FixtureSet) => ContentSource)(config.fixtureSet);
};

export const contentSourceFactories: Record<ContentSourceKind, ContentSourceFactory> = {
  empty: emptyFactory,
  sanity: sanityFactory,
  fixtures: fixturesFactory,
};

export function resolveContentSource(
  config: ContentSourceConfig,
  loaders: ContentSourceLoaders,
  factories: Record<ContentSourceKind, ContentSourceFactory> = contentSourceFactories,
): Promise<ContentSource> {
  return factories[config.kind](config, loaders);
}
