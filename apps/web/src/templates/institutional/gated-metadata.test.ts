import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureContentSource } from "@vitalos/cms/fixtures";

/**
 * Route-level behaviour of the gated templates against the fixture sets (ADR-022; Insights and
 * Careers are now opened in the Super Admin and tested in src/features/content): a closed gate
 * means the index 404s and detail pages are `noindex`; an open gate indexes them. The deployment
 * is mocked as indexable so only the gate decision is visible in the robots metadata.
 */

const state = vi.hoisted(() => ({ set: "sparse" as "full" | "sparse" }));

vi.mock("../../lib/cms/get-content-source", () => ({
  getContentSource: async () => createFixtureContentSource(state.set),
}));
vi.mock("../../features/seo/context", () => ({
  getSeoContext: () => ({ siteUrl: "https://example.invalid", indexable: true }),
}));

// The first import of each route module compiles its whole template tree, which can exceed the
// default 5s test timeout on a cold cache (CI). Import every route once, up front, with a
// generous hook timeout so the individual tests only measure gate behaviour.
beforeAll(async () => {
  await Promise.all([
    import("../../../app/(site)/work/page"),
    import("../../../app/(site)/work/[slug]/page"),
    import("../../../app/(site)/labs/page"),
    import("../../../app/(site)/labs/[type]/page"),
    import("../../../app/(site)/labs/[type]/[slug]/page"),
    import("../../../app/(site)/about/page"),
    import("../../../app/(site)/trust/[topic]/page"),
    import("../../../app/(site)/legal/[slug]/page"),
    import("../../../app/(site)/people/[slug]/page"),
  ]);
}, 120_000);

const params = <T>(value: T) => ({ params: Promise.resolve(value) });

const is404 = { digest: expect.stringContaining("404") };

async function robotsOf(result: unknown) {
  return (result as { robots?: { index?: boolean } }).robots;
}

describe("gated indexes", () => {
  const indexes = [
    ["work", () => import("../../../app/(site)/work/page")],
    ["labs", () => import("../../../app/(site)/labs/page")],
  ] as const;

  for (const [name, load] of indexes) {
    it(`${name}: 404 below the gate, served above it`, async () => {
      const page = await load();
      state.set = "sparse";
      await expect(page.default()).rejects.toMatchObject(is404);
      await expect(page.generateMetadata()).rejects.toMatchObject(is404);
      state.set = "full";
      await expect(page.default()).resolves.toBeTruthy();
      await expect(page.generateMetadata()).resolves.toBeTruthy();
    });
  }

  it("lab categories 404 below the gate and for unknown or empty types", async () => {
    const page = await import("../../../app/(site)/labs/[type]/page");
    state.set = "sparse";
    await expect(page.default(params({ type: "open-source" }))).rejects.toMatchObject(is404);
    state.set = "full";
    await expect(page.default(params({ type: "open-source" }))).resolves.toBeTruthy();
    await expect(page.default(params({ type: "not-a-type" }))).rejects.toMatchObject(is404);
    await expect(page.default(params({ type: "research" }))).rejects.toMatchObject(is404);
  });
});

describe("detail pages of gated sections", () => {
  beforeEach(() => {
    state.set = "sparse";
  });

  it("case study: noindex below the Work gate, indexed above it", async () => {
    const page = await import("../../../app/(site)/work/[slug]/page");
    const input = params({ slug: "example-case-study" });
    expect(await robotsOf(await page.generateMetadata(input))).toEqual({
      index: false,
      follow: false,
    });
    state.set = "full";
    expect(await robotsOf(await page.generateMetadata(input))).toBeUndefined();
  });

  it("case study without verified evidence does not exist", async () => {
    const page = await import("../../../app/(site)/work/[slug]/page");
    state.set = "full";
    await expect(
      page.generateMetadata(params({ slug: "example-case-study-pending" })),
    ).rejects.toMatchObject(is404);
    await expect(
      page.default(params({ slug: "example-case-study-pending" })),
    ).rejects.toMatchObject(is404);
    expect(await page.generateStaticParams()).toEqual([
      { slug: "example-case-study" },
      { slug: "example-case-study-two" },
    ]);
  });

  it("lab asset: indexed above the Labs gate, and the wrong type is a 404", async () => {
    const page = await import("../../../app/(site)/labs/[type]/[slug]/page");
    state.set = "full";
    const input = params({ type: "open-source", slug: "example-open-source-tool" });
    expect(await robotsOf(await page.generateMetadata(input))).toBeUndefined();
    await expect(
      page.generateMetadata(params({ type: "research", slug: "example-open-source-tool" })),
    ).rejects.toMatchObject(is404);
    await expect(
      page.generateMetadata(params({ type: "bogus", slug: "example-open-source-tool" })),
    ).rejects.toMatchObject(is404);
  });
});

describe("ungated pages", () => {
  it("are noindex without any CMS content and 404 for unknown parameters", async () => {
    state.set = "sparse";
    const about = await import("../../../app/(site)/about/page");
    expect(await robotsOf(await about.generateMetadata())).toEqual({ index: false, follow: false });
    state.set = "full";
    expect(await robotsOf(await about.generateMetadata())).toBeUndefined();

    const trust = await import("../../../app/(site)/trust/[topic]/page");
    await expect(trust.default(params({ topic: "nope" }))).rejects.toMatchObject(is404);
    const legal = await import("../../../app/(site)/legal/[slug]/page");
    await expect(legal.default(params({ slug: "imprint" }))).rejects.toMatchObject(is404);
    const person = await import("../../../app/(site)/people/[slug]/page");
    await expect(person.default(params({ slug: "nobody" }))).rejects.toMatchObject(is404);
  });
});
