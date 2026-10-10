import { describe, expect, it, vi } from "vitest";
import { EmptyContentSource } from "@vitalos/cms";
import type { ContentSource } from "@vitalos/cms";
import { contentSourceFactories, resolveContentSource } from "./content-source-factory";
import type { ContentSourceConfig, ContentSourceLoaders } from "./content-source-factory";
import { DraftAwareContentSource, publishedOnly } from "./draft-aware-source";

const config = (overrides: Partial<ContentSourceConfig> = {}): ContentSourceConfig => ({
  kind: "empty",
  deployEnv: "local",
  fixtureSet: "full",
  sanity: { projectId: undefined, dataset: "development", apiVersion: "2025-02-19" },
  ...overrides,
});

const loaders = (overrides: Partial<ContentSourceLoaders> = {}): ContentSourceLoaders => ({
  createSanityFetcher: vi.fn().mockResolvedValue(vi.fn()),
  loadQueriesModule: vi.fn().mockResolvedValue({}),
  loadFixturesModule: vi.fn().mockResolvedValue({}),
  warn: vi.fn(),
  ...overrides,
});

describe("resolveContentSource", () => {
  it("returns the honest empty source for `empty`", async () => {
    const source = await resolveContentSource(config(), loaders());
    expect(source).toBeInstanceOf(EmptyContentSource);
    expect(await source.getHomePage()).toBeNull();
  });

  it("builds the Sanity source from the injected fetcher", async () => {
    const created: ContentSource = new EmptyContentSource();
    const createSanityContentSource = vi.fn().mockReturnValue(created);
    const fetcher = vi.fn();
    const l = loaders({
      loadQueriesModule: vi.fn().mockResolvedValue({ createSanityContentSource }),
      createSanityFetcher: vi.fn().mockResolvedValue(fetcher),
    });
    const source = await resolveContentSource(
      config({
        kind: "sanity",
        sanity: {
          projectId: "abc123xy",
          dataset: "production",
          apiVersion: "2025-02-19",
          readToken: "t",
        },
      }),
      l,
    );
    expect(source).toBe(created);
    expect(l.createSanityFetcher).toHaveBeenCalledWith({
      projectId: "abc123xy",
      dataset: "production",
      apiVersion: "2025-02-19",
      readToken: "t",
    });
    expect(createSanityContentSource).toHaveBeenCalledWith(fetcher);
  });

  it("fails loudly when Sanity is requested but cannot be built", async () => {
    await expect(resolveContentSource(config({ kind: "sanity" }), loaders())).rejects.toThrow(
      /PROJECT_ID/,
    );
    await expect(
      resolveContentSource(
        config({
          kind: "sanity",
          sanity: { projectId: "abc123xy", dataset: "d", apiVersion: "2025-02-19" },
        }),
        loaders(),
      ),
    ).rejects.toThrow(/createSanityContentSource/);
  });

  it("uses the fixture source when it exists, with the configured set", async () => {
    const created = new EmptyContentSource();
    const createFixtureContentSource = vi.fn().mockReturnValue(created);
    const source = await resolveContentSource(
      config({ kind: "fixtures", fixtureSet: "sparse" }),
      loaders({ loadFixturesModule: vi.fn().mockResolvedValue({ createFixtureContentSource }) }),
    );
    expect(source).toBe(created);
    expect(createFixtureContentSource).toHaveBeenCalledWith("sparse");
  });

  it("falls back to the empty source with a warning until fixtures exist", async () => {
    const l = loaders();
    const source = await resolveContentSource(config({ kind: "fixtures" }), l);
    expect(source).toBeInstanceOf(EmptyContentSource);
    expect(l.warn).toHaveBeenCalledOnce();
  });

  it("never serves fixtures in production", async () => {
    await expect(
      resolveContentSource(config({ kind: "fixtures", deployEnv: "production" }), loaders()),
    ).rejects.toThrow(/forbidden in production/);
  });

  it("is extensible: a replacement factory map can add a source", async () => {
    const custom = new EmptyContentSource();
    const source = await resolveContentSource(config({ kind: "fixtures" }), loaders(), {
      ...contentSourceFactories,
      fixtures: () => Promise.resolve(custom),
    });
    expect(source).toBe(custom);
  });
});

describe("DraftAwareContentSource", () => {
  function spySource() {
    const calls: { method: string; args: unknown[] }[] = [];
    const record =
      (method: string, result: unknown) =>
      (...args: unknown[]) => {
        calls.push({ method, args });
        return Promise.resolve(result);
      };
    const inner = {
      getSiteChrome: record("getSiteChrome", { settings: {}, gates: {} }),
      getHomePage: record("getHomePage", null),
      getRoutePage: record("getRoutePage", null),
      getDocument: record("getDocument", null),
      listSummaries: record("listSummaries", []),
      listParams: record("listParams", []),
      getSitemapEntries: record("getSitemapEntries", []),
      getPublicationGates: record("getPublicationGates", {}),
    } as unknown as ContentSource;
    return { inner, calls };
  }

  it("injects the resolved preview flag into every read that takes options", async () => {
    const { inner, calls } = spySource();
    const source = new DraftAwareContentSource(inner, () => Promise.resolve(true));
    await source.getHomePage();
    await source.getRoutePage("work");
    await source.listSummaries("practice");
    await source.getPublicationGates();
    await source.getSiteChrome();
    await source.getDocument("practice", "consulting");
    await source.getDocument("labAsset", "x", { labType: "research" });
    for (const call of calls) {
      expect(call.args.at(-1)).toMatchObject({ preview: true });
    }
    expect(calls.at(-1)?.args.at(-1)).toEqual({ labType: "research", preview: true });
  });

  it("lets a caller opt out of preview and always reads published for static data", async () => {
    const { inner, calls } = spySource();
    const resolve = vi.fn((explicit: boolean | undefined) => Promise.resolve(explicit !== false));
    const source = new DraftAwareContentSource(inner, resolve);
    await source.getHomePage({ preview: false });
    expect(calls[0]?.args[0]).toEqual({ preview: false });
    await source.listParams("practice");
    await source.getSitemapEntries();
    expect(calls[1]?.args).toEqual(["practice"]);
    expect(calls[2]?.args).toEqual([]);
  });

  it("publishedOnly never previews, whatever the caller asks", async () => {
    const { inner, calls } = spySource();
    const source = new DraftAwareContentSource(inner, publishedOnly);
    await source.getHomePage({ preview: true });
    expect(calls[0]?.args[0]).toEqual({ preview: false });
  });
});
