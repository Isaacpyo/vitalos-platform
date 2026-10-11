import { describe, expect, it } from "vitest";
import type { FixtureSet } from "./fixture-source";
import { createSanityContentSource } from "./sanity-source";
import { EmptyContentSource } from "./source";
import { describeContentSourceContract, docKinds } from "./testing/contract";
import { createFixtureSanityFetcher } from "./testing/sanity-fixture-fetcher";
import { createFixtureContentSource, fullFixtureSet, sparseFixtureSet } from "../fixtures";
import { routePageKeys } from "../routes";

const NOW = () => new Date("2026-10-10T12:00:00Z");

const fixtureSource = (set: FixtureSet) => createFixtureContentSource(set, { now: NOW });
const sanitySource = (set: FixtureSet) =>
  createSanityContentSource(createFixtureSanityFetcher(set), { now: NOW });

describeContentSourceContract("EmptyContentSource", () => new EmptyContentSource(), {
  empty: true,
  gates: "closed",
});
describeContentSourceContract("Fixture (full)", () => fixtureSource(fullFixtureSet), {
  gates: "open",
});
describeContentSourceContract("Fixture (sparse)", () => fixtureSource(sparseFixtureSet), {
  gates: "closed",
});
describeContentSourceContract(
  "Sanity source (full fixture-shaped documents)",
  () => sanitySource(fullFixtureSet),
  {
    gates: "open",
  },
);
describeContentSourceContract(
  "Sanity source (sparse fixture-shaped documents)",
  () => sanitySource(sparseFixtureSet),
  {
    gates: "closed",
  },
);

describe("Sanity source reproduces the fixture source for the same content", () => {
  for (const set of [fullFixtureSet, sparseFixtureSet]) {
    describe(`${set.name} set`, () => {
      const fixture = fixtureSource(set);
      const sanity = sanitySource(set);

      it("site chrome, home page and gates", async () => {
        await expect(sanity.getSiteChrome()).resolves.toEqual(await fixture.getSiteChrome());
        await expect(sanity.getHomePage()).resolves.toEqual(await fixture.getHomePage());
        await expect(sanity.getPublicationGates()).resolves.toEqual(
          await fixture.getPublicationGates(),
        );
      });

      it("route pages", async () => {
        for (const key of routePageKeys) {
          await expect(sanity.getRoutePage(key), key).resolves.toEqual(
            await fixture.getRoutePage(key),
          );
        }
      });

      it("summaries, params and sitemap", async () => {
        for (const kind of docKinds) {
          await expect(sanity.listSummaries(kind), kind).resolves.toEqual(
            await fixture.listSummaries(kind),
          );
          await expect(sanity.listParams(kind), kind).resolves.toEqual(
            await fixture.listParams(kind),
          );
        }
        await expect(sanity.getSitemapEntries()).resolves.toEqual(
          await fixture.getSitemapEntries(),
        );
      });

      it("every document", async () => {
        for (const kind of docKinds) {
          for (const params of await fixture.listParams(kind)) {
            const read = (source: typeof fixture) =>
              kind === "trustItem"
                ? source.getDocument("trustItem", params.topic as "security")
                : kind === "legalPage"
                  ? source.getDocument("legalPage", params.slug as "privacy")
                  : kind === "labAsset"
                    ? source.getDocument("labAsset", params.slug as string, {
                        labType: params.type as "research",
                      })
                    : source.getDocument(kind as "practice", params.slug as string);
            await expect(read(sanity), `${kind} ${JSON.stringify(params)}`).resolves.toEqual(
              await read(fixture),
            );
          }
        }
      });
    });
  }
});

describe("fixture sets", () => {
  it("full is above every gate and sparse below every gate", async () => {
    const full = await fixtureSource(fullFixtureSet).getPublicationGates();
    const sparse = await fixtureSource(sparseFixtureSet).getPublicationGates();
    expect(Object.values(full.open).every(Boolean)).toBe(true);
    expect(Object.values(sparse.open).some(Boolean)).toBe(false);
    expect(full.counts.work).toBe(2);
    expect(full.counts.insights).toBeGreaterThanOrEqual(6);
    expect(sparse.counts.work).toBe(1);
  });

  it("sparse closes the gate when a pending case study is the only one besides a verified one", async () => {
    // Full lists the pending case study but does not count it.
    const full = fixtureSource(fullFixtureSet);
    expect(await full.listSummaries("caseStudy")).toHaveLength(3);
    expect((await full.getPublicationGates()).counts.work).toBe(2);
  });

  it("a role past its validity date leaves the careers gate and the index but keeps its page", async () => {
    const later = createFixtureContentSource(fullFixtureSet, {
      now: () => new Date("2100-06-01T00:00:00Z"),
    });
    expect((await later.getPublicationGates()).open.careers).toBe(false);
    expect(await later.listSummaries("job")).toEqual([]);
    expect(await later.listParams("job")).toHaveLength(2);
  });

  it("sitemap lists open roles and lab types, never closed or expired roles", async () => {
    const paths = async (now?: Date) =>
      (
        await createFixtureContentSource(
          fullFixtureSet,
          now ? { now: () => now } : {},
        ).getSitemapEntries()
      ).map((entry) => entry.path);
    const current = await paths(new Date("2026-10-10T12:00:00Z"));
    expect(current).toContain("/careers/example-role");
    expect(current).not.toContain("/careers/example-closed-role");
    expect(current.some((path) => /^\/labs\/[^/]+$/.test(path))).toBe(true);
    // Past the validity date the formerly open role leaves the sitemap too (page stays served).
    const later = await paths(new Date("2100-06-01T00:00:00Z"));
    expect(later).not.toContain("/careers/example-role");
    expect(later.some((path) => path.startsWith("/careers/"))).toBe(false);
  });

  it("sparse excludes documents of closed gates from the sitemap", async () => {
    const sitemap = await fixtureSource(sparseFixtureSet).getSitemapEntries();
    const kinds = new Set(sitemap.map((entry) => entry.kind));
    for (const gated of ["caseStudy", "insight", "labAsset", "industry", "job"] as const) {
      expect(kinds.has(gated)).toBe(false);
    }
    expect(kinds.has("practice")).toBe(true);
  });
});
