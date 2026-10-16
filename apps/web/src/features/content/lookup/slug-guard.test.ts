import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ContentNotFoundError, ContentUnavailableError } from "../client";
import { createReaders } from "../readers";
import { createSlugGuard } from "./slug-guard";
import { lookupVerdict } from "./verdict";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../../contracts/content-api/v1/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  );

/** A fake admin that counts reads per path; the sitemap lists the fixture post, topic, author, role. */
function admin() {
  const answers: Record<string, unknown> = {
    "/api/content/v1/site-state": fixture("site-state"),
    "/api/content/v1/sitemap": fixture("sitemap"),
    "/api/content/v1/insights/posts/example-post-1": fixture("post-detail"),
    "/api/content/v1/insights/posts/old-slug": fixture("redirect"),
    "/api/content/v1/careers/roles/example-role-fixture": fixture("role-open"),
    "/api/content/v1/careers/roles/closed-role": fixture("role-closed"),
    "/api/content/v1/careers/page": fixture("careers-page"),
  };
  const reads: Record<string, number> = {};
  const get = vi.fn(async (pathAndQuery: string, schema: { parse(v: unknown): unknown }) => {
    const path = pathAndQuery.split("?")[0] ?? "";
    reads[path] = (reads[path] ?? 0) + 1;
    const answer = answers[path];
    if (answer instanceof Error) throw answer;
    if (answer === undefined) throw new ContentNotFoundError();
    return schema.parse(answer);
  });
  const readers = createReaders({
    client: { get, post: vi.fn() } as never,
    cache: (fn) => fn,
    ttlSeconds: 600,
  });
  return { readers, reads, answers };
}

const detailReads = (reads: Record<string, number>) =>
  Object.entries(reads)
    .filter(([path]) => /\/(posts|roles|authors|topics)\//.test(path))
    .reduce((total, [, count]) => total + count, 0);

describe("the lookup's slug pre-filter", () => {
  it("answers listed paths with a normal read, without using the confirm budget", async () => {
    const { readers } = admin();
    const guard = createSlugGuard({ perMinute: 0 });
    expect(await lookupVerdict("/insights/example-post-1", readers, guard)).toEqual({
      verdict: "ok",
    });
    expect(await lookupVerdict("/careers/example-role-fixture", readers, guard)).toEqual({
      verdict: "ok",
    });
  });

  it("caps admin reads for unlisted slugs per minute, then answers missing without asking", async () => {
    let clock = 0;
    const { readers, reads } = admin();
    const guard = createSlugGuard({ perMinute: 3, now: () => clock });
    for (let i = 0; i < 20; i += 1) {
      expect(await lookupVerdict(`/insights/random-${i}`, readers, guard)).toEqual({
        verdict: "missing",
      });
    }
    // Twenty random slugs, three admin reads.
    expect(detailReads(reads)).toBe(3);
    clock = 60_000;
    await lookupVerdict("/careers/random-role", readers, guard);
    expect(detailReads(reads)).toBe(4);
  });

  it("still redirects an old slug (confirmed within the budget, then remembered)", async () => {
    let clock = 0;
    const { readers } = admin();
    const guard = createSlugGuard({ perMinute: 1, now: () => clock });
    expect(await lookupVerdict("/insights/old-slug", readers, guard)).toEqual({
      verdict: "redirect",
      location: "/insights/example-post-1",
    });
    // The budget is spent, but a confirmed real path never needs it again.
    expect(await lookupVerdict("/insights/old-slug", readers, guard)).toEqual({
      verdict: "redirect",
      location: "/insights/example-post-1",
    });
    expect(await lookupVerdict("/insights/random", readers, guard)).toEqual({ verdict: "missing" });
    // Next minute the budget is back for genuinely new paths.
    clock = 120_000;
    expect(guard.allowConfirm()).toBe(true);
  });

  it("keeps a closed role's page (not in the sitemap) once confirmed", async () => {
    const { readers } = admin();
    const guard = createSlugGuard({ perMinute: 1 });
    expect(await lookupVerdict("/careers/closed-role", readers, guard)).toEqual({ verdict: "ok" });
    expect(guard.isRemembered("/careers/closed-role")).toBe(true);
  });

  it("serves a post published moments ago once the sitemap read lists it", async () => {
    const { readers, answers } = admin();
    const guard = createSlugGuard({ perMinute: 0 });
    answers["/api/content/v1/insights/posts/fresh-post"] = {
      ...(fixture("post-detail") as object),
      slug: "fresh-post",
    };
    // Before the sitemap tag is revalidated: no budget, so missing (the proxy re-asks within 3 s).
    expect(await lookupVerdict("/insights/fresh-post", readers, guard)).toEqual({
      verdict: "missing",
    });
    // The publish event revalidates `sitemap`; the next read lists the post.
    const sitemap = structuredClone(fixture("sitemap")) as {
      entries: { path: string; lastModified: string }[];
    };
    sitemap.entries.push({ path: "/insights/fresh-post", lastModified: "2026-10-15T10:00:00Z" });
    answers["/api/content/v1/sitemap"] = sitemap;
    expect(await lookupVerdict("/insights/fresh-post", readers, guard)).toEqual({ verdict: "ok" });
  });

  it("with budget to spare, finds a fresh post even before the sitemap lists it", async () => {
    const { readers, answers } = admin();
    const guard = createSlugGuard({ perMinute: 30 });
    answers["/api/content/v1/insights/posts/fresh-post"] = {
      ...(fixture("post-detail") as object),
      slug: "fresh-post",
    };
    expect(await lookupVerdict("/insights/fresh-post", readers, guard)).toEqual({ verdict: "ok" });
  });

  it("checks topic pages and author pages against their listed paths", async () => {
    const { readers, reads } = admin();
    const guard = createSlugGuard({ perMinute: 0 });
    expect(await lookupVerdict("/insights/authors/nobody", readers, guard)).toEqual({
      verdict: "missing",
    });
    expect(await lookupVerdict("/insights/topics/nothing/page/2", readers, guard)).toEqual({
      verdict: "missing",
    });
    expect(detailReads(reads)).toBe(0);
  });

  it("keeps today's behaviour when the sitemap cannot be read", async () => {
    const { readers, reads, answers } = admin();
    answers["/api/content/v1/sitemap"] = new ContentUnavailableError("timeout");
    const guard = createSlugGuard({ perMinute: 0 });
    expect(await lookupVerdict("/insights/example-post-1", readers, guard)).toEqual({
      verdict: "ok",
    });
    expect(await lookupVerdict("/insights/random", readers, guard)).toEqual({ verdict: "missing" });
    expect(reads["/api/content/v1/insights/posts/random"]).toBe(1);
  });

  it("does not filter index pages or the feed", async () => {
    const { readers } = admin();
    const guard = createSlugGuard({ perMinute: 0 });
    expect(await lookupVerdict("/careers", readers, guard)).toEqual({ verdict: "ok" });
  });
});

describe("createSlugGuard", () => {
  it("bounds what it remembers", () => {
    const guard = createSlugGuard({ maxRemembered: 2 });
    guard.remember("/a");
    guard.remember("/b");
    guard.remember("/c");
    expect(guard.isRemembered("/a")).toBe(false);
    expect(guard.isRemembered("/c")).toBe(true);
  });
});
