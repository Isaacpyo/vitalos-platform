// Artificial fixture content sets ("full" and "sparse") and the fixture ContentSource.
// Entry: `@vitalos/cms/fixtures`. Fixtures are forbidden in production (see @vitalos/config).
import { createFixtureSource, summaryOf } from "../content/fixture-source";
import type {
  FixtureContentSourceOptions,
  FixtureSet,
  FixtureSetName,
} from "../content/fixture-source";
import type { ContentSource } from "../content/source";
import { fullFixtureSet } from "./full";
import { sparseFixtureSet } from "./sparse";

export { summaryOf };
export type { FixtureContentSourceOptions, FixtureSet, FixtureSetName };
export { fullFixtureSet, sparseFixtureSet };

export const fixtureSets: Record<FixtureSetName, FixtureSet> = {
  full: fullFixtureSet,
  sparse: sparseFixtureSet,
};

/**
 * The fixture `ContentSource`. Takes a set name (`VITALOS_FIXTURE_SET`: "full" or "sparse") or a
 * set object, and an optional clock for expiry checks (job validity).
 */
export function createFixtureContentSource(
  set: FixtureSetName | FixtureSet = "full",
  options: FixtureContentSourceOptions = {},
): ContentSource {
  const resolved = typeof set === "string" ? fixtureSets[set] : set;
  // Config validates the name; a bad one here is a programming error, not empty content.
  if (!resolved) throw new Error(`Unknown fixture set: ${JSON.stringify(set)}`);
  return createFixtureSource(resolved, options);
}
