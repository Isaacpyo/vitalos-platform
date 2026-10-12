import { describe, expect, it, vi } from "vitest";
import { EmptyContentSource } from "@vitalos/cms";
import { contentSourceFactories, resolveContentSource } from "./content-source-factory";
import type { ContentSourceConfig, ContentSourceLoaders } from "./content-source-factory";

const config = (overrides: Partial<ContentSourceConfig> = {}): ContentSourceConfig => ({
  kind: "empty",
  deployEnv: "local",
  fixtureSet: "full",
  ...overrides,
});

const loaders = (overrides: Partial<ContentSourceLoaders> = {}): ContentSourceLoaders => ({
  loadFixturesModule: vi.fn().mockResolvedValue({}),
  loadDraftModule: vi.fn().mockResolvedValue({}),
  loadRepoModule: vi.fn().mockResolvedValue({}),
  warn: vi.fn(),
  ...overrides,
});

describe("resolveContentSource", () => {
  it("returns the honest empty source for `empty`", async () => {
    const source = await resolveContentSource(config(), loaders());
    expect(source).toBeInstanceOf(EmptyContentSource);
    expect(await source.getHomePage()).toBeNull();
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

  it("uses the draft source outside production", async () => {
    const created = new EmptyContentSource();
    const createDraftContentSource = vi.fn().mockReturnValue(created);
    for (const deployEnv of ["local", "preview", "staging"]) {
      const l = loaders({
        loadDraftModule: vi.fn().mockResolvedValue({ createDraftContentSource }),
      });
      await expect(resolveContentSource(config({ kind: "draft", deployEnv }), l)).resolves.toBe(
        created,
      );
      expect(l.loadFixturesModule).not.toHaveBeenCalled();
    }
  });

  it("never serves draft content in production, and does not even load it", async () => {
    const l = loaders();
    await expect(
      resolveContentSource(config({ kind: "draft", deployEnv: "production" }), l),
    ).rejects.toThrow(/forbidden in production/);
    expect(l.loadDraftModule).not.toHaveBeenCalled();
  });

  it("fails loudly (no empty fallback) when the draft module is missing", async () => {
    const l = loaders();
    await expect(resolveContentSource(config({ kind: "draft" }), l)).rejects.toThrow(
      /createDraftContentSource/,
    );
    expect(l.warn).not.toHaveBeenCalled();
  });

  it("the real draft module provides a working source", async () => {
    const mod = (await import("@vitalos/cms/draft")) as unknown as Record<string, unknown>;
    const source = await resolveContentSource(
      config({ kind: "draft" }),
      loaders({ loadDraftModule: () => Promise.resolve(mod) }),
    );
    expect(await source.listSummaries("practice")).toHaveLength(5);
  });

  it("serves the repo source in every environment, production included", async () => {
    const created = new EmptyContentSource();
    const createRepoContentSource = vi.fn().mockReturnValue(created);
    for (const deployEnv of ["local", "preview", "staging", "production"]) {
      const l = loaders({ loadRepoModule: vi.fn().mockResolvedValue({ createRepoContentSource }) });
      await expect(resolveContentSource(config({ kind: "repo", deployEnv }), l)).resolves.toBe(
        created,
      );
    }
  });

  it("fails loudly (no empty fallback) when the repo module is missing", async () => {
    await expect(resolveContentSource(config({ kind: "repo" }), loaders())).rejects.toThrow(
      /createRepoContentSource/,
    );
  });

  it("the real repo module provides a working production source", async () => {
    const mod = (await import("@vitalos/cms/repo")) as unknown as Record<string, unknown>;
    const source = await resolveContentSource(
      config({ kind: "repo", deployEnv: "production" }),
      loaders({ loadRepoModule: () => Promise.resolve(mod) }),
    );
    expect(await source.listSummaries("practice")).toHaveLength(5);
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
