/**
 * `/insights?format={slug}[&page={n}]` keeps its public URL but is served by static (ISR) routes
 * under `/insights/format/…`, so the index never reads `searchParams` and stays static
 * (brief 5.1). Used by `next.config.ts` as `beforeFiles` rewrites (after the proxy).
 */
const FORMAT = "(?<format>[a-z0-9]+(?:-[a-z0-9]+)*)";
const PAGE = "(?<page>[1-9][0-9]{0,3})";

export const insightsRewrites = [
  {
    source: "/insights",
    has: [
      { type: "query" as const, key: "format", value: FORMAT },
      { type: "query" as const, key: "page", value: PAGE },
    ],
    destination: "/insights/format/:format/page/:page",
  },
  {
    source: "/insights",
    has: [{ type: "query" as const, key: "format", value: FORMAT }],
    destination: "/insights/format/:format",
  },
];
