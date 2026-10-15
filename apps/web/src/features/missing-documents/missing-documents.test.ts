import { describe, expect, it, vi } from "vitest";
import { createMissingDocumentChecker } from "./checker";
import { legacyContentFamilies, matchDetailRoute } from "./detail-routes";

describe("matchDetailRoute", () => {
  it("recognises every dynamic detail family", () => {
    const cases: [string, string, string[]][] = [
      ["/what-we-do/p", "practice", ["p"]],
      ["/solutions/s", "solution", ["s"]],
      ["/offers/o", "offer", ["o"]],
      ["/industries/i", "industry", ["i"]],
      ["/work/c", "caseStudy", ["c"]],
      ["/people/p", "person", ["p"]],
      ["/legal/privacy", "legalPage", ["privacy"]],
      ["/trust/security", "trustItem", ["security"]],
      ["/labs/open-source", "labAsset", ["open-source"]],
      ["/labs/open-source/tool", "labAsset", ["open-source", "tool"]],
    ];
    for (const [path, kind, values] of cases) {
      expect(matchDetailRoute(path), path).toMatchObject({ kind, values });
    }
  });

  it("leaves Insights and Careers to the content lookup, except in the legacy table", () => {
    expect(matchDetailRoute("/insights/a")).toBeNull();
    expect(matchDetailRoute("/careers/r")).toBeNull();
    expect(matchDetailRoute("/insights/a", legacyContentFamilies)).toBeNull();
    expect(matchDetailRoute("/careers/r", legacyContentFamilies)).toMatchObject({
      kind: "job",
      values: ["r"],
    });
    expect(matchDetailRoute("/solutions/s", legacyContentFamilies)).toBeNull();
    expect(matchDetailRoute("/constructor/x")).toBeNull();
  });

  it("ignores index pages, static pages, API routes, assets and deeper paths", () => {
    for (const path of [
      "/",
      "/what-we-do",
      "/solutions",
      "/labs",
      "/about/leadership",
      "/contact",
      "/api/health",
      "/_next/static/x.js",
      "/solutions/a/b",
      "/labs/a/b/c",
      "/unknown/thing",
    ]) {
      expect(matchDetailRoute(path), path).toBeNull();
    }
  });

  it("ignores a trailing slash and decodes the slug, and leaves malformed escapes to the page", () => {
    expect(matchDetailRoute("/solutions/s/")).toMatchObject({ values: ["s"] });
    expect(matchDetailRoute("/solutions/a%20b")).toMatchObject({ values: ["a b"] });
    expect(matchDetailRoute("/solutions/%E0%A4%A")).toBeNull();
  });
});

describe("createMissingDocumentChecker", () => {
  const lists: Record<string, Record<string, string>[]> = {
    solution: [{ slug: "known" }],
    trustItem: [{ topic: "security" }],
    labAsset: [{ type: "open-source", slug: "tool" }],
  };
  const make = (overrides: Partial<Parameters<typeof createMissingDocumentChecker>[0]> = {}) =>
    createMissingDocumentChecker({
      listParams: vi.fn((kind: string) => Promise.resolve(lists[kind] ?? [])),
      ...overrides,
    });

  it("reports an unknown document as missing and a known one as present", async () => {
    const checker = make();
    expect(await checker.isMissing("/solutions/known")).toBe(false);
    expect(await checker.isMissing("/solutions/unknown")).toBe(true);
    expect(await checker.isMissing("/trust/security")).toBe(false);
    expect(await checker.isMissing("/trust/other")).toBe(true);
  });

  it("addresses lab types and lab assets separately", async () => {
    const checker = make();
    expect(await checker.isMissing("/labs/open-source")).toBe(false);
    expect(await checker.isMissing("/labs/research")).toBe(true);
    expect(await checker.isMissing("/labs/open-source/tool")).toBe(false);
    expect(await checker.isMissing("/labs/open-source/none")).toBe(true);
    expect(await checker.isMissing("/labs/research/tool")).toBe(true);
  });

  it("never reads for a path that is not a detail route", async () => {
    const listParams = vi.fn(() => Promise.resolve([]));
    const checker = make({ listParams });
    expect(await checker.isMissing("/what-we-do")).toBe(false);
    expect(await checker.isMissing("/api/health")).toBe(false);
    expect(listParams).not.toHaveBeenCalled();
  });

  it("fails open when the list cannot be read, remembers the failure briefly, then retries", async () => {
    let clock = 0;
    const listParams = vi
      .fn<(kind: string) => Promise<Record<string, string>[]>>()
      .mockRejectedValueOnce(new Error("content source down"))
      .mockResolvedValue([{ slug: "known" }]);
    const checker = make({ listParams, now: () => clock, failureTtlMs: 5000 });
    expect(await checker.isMissing("/solutions/anything")).toBe(false);
    clock = 1000;
    expect(await checker.isMissing("/solutions/anything")).toBe(false);
    expect(listParams).toHaveBeenCalledTimes(1);
    clock = 5001;
    expect(await checker.isMissing("/solutions/anything")).toBe(true);
    expect(listParams).toHaveBeenCalledTimes(2);
  });

  it("fails open when the read times out", async () => {
    vi.useFakeTimers();
    try {
      const listParams = vi.fn(() => new Promise<Record<string, string>[]>(() => undefined));
      const checker = make({ listParams, timeoutMs: 1500 });
      const result = checker.isMissing("/solutions/anything");
      await vi.advanceTimersByTimeAsync(1500);
      expect(await result).toBe(false);
      // The failure is cached: no second slow read for the next request.
      expect(await checker.isMissing("/solutions/other")).toBe(false);
      expect(listParams).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("serves the stale list while the source is failing", async () => {
    let clock = 0;
    const listParams = vi
      .fn<(kind: string) => Promise<Record<string, string>[]>>()
      .mockResolvedValueOnce([{ slug: "known" }])
      .mockRejectedValue(new Error("down"));
    const checker = make({ listParams, now: () => clock, ttlMs: 1000 });
    expect(await checker.isMissing("/solutions/known")).toBe(false);
    clock = 5000;
    // Stale entry still has the document; the failed refresh does not turn it into a 404.
    expect(await checker.isMissing("/solutions/known")).toBe(false);
    expect(await checker.isMissing("/solutions/unknown")).toBe(false);
  });

  it("confirms an old cached 'missing' with a fresh read before answering 404", async () => {
    let clock = 0;
    const listParams = vi
      .fn<(kind: string) => Promise<Record<string, string>[]>>()
      .mockResolvedValueOnce([{ slug: "known" }])
      .mockResolvedValue([{ slug: "known" }, { slug: "just-published" }]);
    const checker = make({ listParams, now: () => clock, confirmMs: 3000 });
    // Young entry: trusted as it is.
    expect(await checker.isMissing("/solutions/just-published")).toBe(true);
    expect(listParams).toHaveBeenCalledTimes(1);
    // Older than confirmMs: re-read, finds the new document.
    clock = 4000;
    expect(await checker.isMissing("/solutions/just-published")).toBe(false);
    expect(listParams).toHaveBeenCalledTimes(2);
    // Genuinely missing stays missing after confirmation.
    expect(await checker.isMissing("/solutions/nope")).toBe(true);
  });

  it("reads once per kind within the window and again after it", async () => {
    let clock = 0;
    const listParams = vi.fn((kind: string) => Promise.resolve(lists[kind] ?? []));
    const checker = make({ listParams, ttlMs: 1000, now: () => clock });
    await checker.isMissing("/solutions/a");
    await checker.isMissing("/solutions/b");
    await checker.isMissing("/solutions/c");
    expect(listParams).toHaveBeenCalledTimes(1);
    clock = 1001;
    await checker.isMissing("/solutions/a");
    expect(listParams).toHaveBeenCalledTimes(2);
  });

  it("shares one read between concurrent requests", async () => {
    const listParams = vi.fn(() => Promise.resolve([{ slug: "known" }]));
    const checker = make({ listParams });
    await Promise.all([
      checker.isMissing("/solutions/a"),
      checker.isMissing("/solutions/b"),
      checker.isMissing("/solutions/known"),
    ]);
    expect(listParams).toHaveBeenCalledTimes(1);
  });

  it("reset forgets the cached lists", async () => {
    const listParams = vi.fn(() => Promise.resolve([{ slug: "known" }]));
    const checker = make({ listParams });
    await checker.isMissing("/solutions/known");
    checker.reset();
    await checker.isMissing("/solutions/known");
    expect(listParams).toHaveBeenCalledTimes(2);
  });
});
