import { EmptyContentSource } from "@vitalos/cms";
import type { ContentSource } from "@vitalos/cms";
import type { ContentSourceKind, FixtureSet } from "@vitalos/config";

/**
 * Chooses the `ContentSource` implementation (ADR-028). Pure selection logic: dynamic
 * imports sit behind injectable loaders so it is unit-testable.
 *
 * Extension point: add a kind to `contentSourceFactories` (or pass a replacement map to
 * `resolveContentSource`). Each factory receives the validated configuration and returns a
 * `ContentSource`. The platform builds and runs with `empty`, which is the honest empty state.
 */

export interface ContentSourceConfig {
  kind: ContentSourceKind;
  deployEnv: string;
  fixtureSet: FixtureSet;
}

export interface ContentSourceLoaders {
  /** Module that exports `createFixtureContentSource(set)` (workstream C2). */
  loadFixturesModule(): Promise<Record<string, unknown>>;
  /** Module that exports `createDraftContentSource()` (`@vitalos/cms/draft`, ADR-025). */
  loadDraftModule(): Promise<Record<string, unknown>>;
  /** Module that exports `createRepoContentSource()` (`@vitalos/cms/repo`, ADR-028). */
  loadRepoModule(): Promise<Record<string, unknown>>;
  warn(message: string): void;
}

export type ContentSourceFactory = (
  config: ContentSourceConfig,
  loaders: ContentSourceLoaders,
) => Promise<ContentSource>;

const emptyFactory: ContentSourceFactory = () => Promise.resolve(new EmptyContentSource());

/**
 * Fixtures (artificial content, never production). If the module does not export
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

/**
 * Draft editorial content (repo-authored, pending owner approval; ADR-025). Never production:
 * configuration already rejects it there and this check is the second line. Unlike fixtures there
 * is no fallback: asking for draft content and silently getting an empty site would hide a
 * packaging error.
 */
const draftFactory: ContentSourceFactory = async (config, loaders) => {
  if (config.deployEnv === "production") {
    throw new Error("The draft content source is forbidden in production.");
  }
  const mod = await loaders.loadDraftModule();
  const create = mod["createDraftContentSource"];
  if (typeof create !== "function") {
    throw new Error(
      "The draft content source is not available: @vitalos/cms/draft does not export createDraftContentSource.",
    );
  }
  return (create as () => ContentSource)();
};

/**
 * Repo-file content (ADR-028): the approved subset of the drafted content, stored in the repo. The
 * production content source. No fallback: asking for repo content and silently getting an empty site
 * would hide a packaging error.
 */
const repoFactory: ContentSourceFactory = async (_config, loaders) => {
  const mod = await loaders.loadRepoModule();
  const create = mod["createRepoContentSource"];
  if (typeof create !== "function") {
    throw new Error(
      "The repo content source is not available: @vitalos/cms/repo does not export createRepoContentSource.",
    );
  }
  return (create as () => ContentSource)();
};

export const contentSourceFactories: Record<ContentSourceKind, ContentSourceFactory> = {
  empty: emptyFactory,
  fixtures: fixturesFactory,
  draft: draftFactory,
  repo: repoFactory,
};

export function resolveContentSource(
  config: ContentSourceConfig,
  loaders: ContentSourceLoaders,
  factories: Record<ContentSourceKind, ContentSourceFactory> = contentSourceFactories,
): Promise<ContentSource> {
  return factories[config.kind](config, loaders);
}
