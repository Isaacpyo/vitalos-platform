/**
 * `/careers?{practice|workModel|employmentType}={value}` keeps its public URL but is served by a
 * static (ISR) route, so `/careers` never reads `searchParams` (brief 6.1; the same technique as
 * the Insights formats). Used by `next.config.ts` as `beforeFiles` rewrites.
 */
const VALUE = "(?<value>[a-z0-9]+(?:[_-][a-z0-9]+)*)";

export const careersRewrites = (["practice", "workModel", "employmentType"] as const).map(
  (dimension) => ({
    source: "/careers",
    has: [{ type: "query" as const, key: dimension, value: VALUE }],
    destination: `/careers/filter/${dimension}/:value`,
  }),
);
