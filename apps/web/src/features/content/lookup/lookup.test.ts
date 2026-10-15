import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ContentNotFoundError, ContentUnavailableError } from "../client";
import { CLOSED_SITE_STATE, createReaders } from "../readers";
import type { CacheFunction, ContentReaders } from "../readers";
import { signLookup, verifyLookup } from "./auth";
import { VerdictSchema, createProxyLookup } from "./proxy-lookup";
import type { Verdict } from "./verdict";
import { isContentLookupPath, lookupVerdict } from "./verdict";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../../contracts/content-api/v1/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  );

describe("lookup auth", () => {
  const secret = "r".repeat(40);
  const now = 1_800_000_000;

  it("accepts its own header for the same path within 60 s", () => {
    const header = signLookup(secret, "/insights/a", now);
    expect(verifyLookup(secret, header, "/insights/a", now + 60)).toBe(true);
    expect(verifyLookup(secret, header, "/insights/a", now + 61)).toBe(false);
  });

  it("refuses another path, another secret, junk and a missing secret", () => {
    const header = signLookup(secret, "/insights/a", now);
    expect(verifyLookup(secret, header, "/insights/b", now)).toBe(false);
    expect(verifyLookup("s".repeat(40), header, "/insights/a", now)).toBe(false);
    expect(verifyLookup(secret, null, "/insights/a", now)).toBe(false);
    expect(verifyLookup(secret, "123.abc", "/insights/a", now)).toBe(false);
    expect(verifyLookup(undefined, header, "/insights/a", now)).toBe(false);
  });

  it("is not a request signature: the derived key differs from the read secret", () => {
    const header = signLookup(secret, "/insights/a", now);
    expect(header).not.toContain(secret);
  });
});

describe("isContentLookupPath", () => {
  it("covers every Insights and Careers page and nothing else", () => {
    for (const path of [
      "/insights",
      "/insights/page/2",
      "/insights/feed.xml",
      "/insights/a-post",
      "/insights/authors/a",
      "/insights/topics/t",
      "/careers",
      "/careers/a-role",
    ]) {
      expect(isContentLookupPath(path), path).toBe(true);
    }
    for (const path of [
      "/",
      "/insights/",
      "/insights/a/b/c",
      "/insights/UPPER",
      "/insights/page/0",
      "/careers/a/b",
      "/about",
      "/api/content/lookup",
    ]) {
      expect(isContentLookupPath(path), path).toBe(false);
    }
  });
});

/** Readers over a fake admin, through a pass-through cache. */
function readersWith(overrides: Record<string, unknown | Error> = {}, configured = true) {
  const answers: Record<string, unknown> = {
    "/api/content/v1/site-state": fixture("site-state"),
    "/api/content/v1/insights/posts": fixture("post-page"),
    "/api/content/v1/insights/posts/example-post-1": fixture("post-detail"),
    "/api/content/v1/insights/posts/old-slug": fixture("redirect"),
    "/api/content/v1/insights/authors/example-author": fixture("author"),
    "/api/content/v1/insights/authors/old-author": { redirect: "example-author" },
    "/api/content/v1/insights/topics/example-topic": fixture("topic"),
    "/api/content/v1/insights/feed": fixture("feed"),
    "/api/content/v1/careers/page": fixture("careers-page"),
    "/api/content/v1/careers/roles/example-role-fixture": fixture("role-open"),
    "/api/content/v1/careers/roles/closed-role": fixture("role-closed"),
    ...overrides,
  };
  const get = vi.fn(async (pathAndQuery: string, schema: { parse(v: unknown): unknown }) => {
    const answer = answers[pathAndQuery.split("?")[0] ?? ""];
    if (answer instanceof Error) throw answer;
    if (answer === undefined) throw new ContentNotFoundError();
    return schema.parse(answer);
  });
  const cache: CacheFunction = (fn) => fn;
  return createReaders({
    client: configured ? ({ get, post: vi.fn() } as never) : null,
    cache,
    ttlSeconds: 600,
  });
}

describe("lookupVerdict", () => {
  const verdict = (path: string, readers: ContentReaders = readersWith()) =>
    lookupVerdict(path, readers);

  it("answers ok for live pages", async () => {
    for (const path of [
      "/insights",
      "/insights/feed.xml",
      "/insights/example-post-1",
      "/insights/authors/example-author",
      "/insights/topics/example-topic",
      "/careers",
      "/careers/example-role-fixture",
      "/careers/closed-role",
    ]) {
      expect(await verdict(path), path).toEqual({ verdict: "ok" });
    }
  });

  it("redirects old slugs and page 1", async () => {
    expect(await verdict("/insights/old-slug")).toEqual({
      verdict: "redirect",
      location: "/insights/example-post-1",
    });
    expect(await verdict("/insights/authors/old-author")).toEqual({
      verdict: "redirect",
      location: "/insights/authors/example-author",
    });
    expect(await verdict("/insights/page/1")).toEqual({
      verdict: "redirect",
      location: "/insights",
    });
  });

  it("answers missing for unknown items and out-of-range pages", async () => {
    expect(await verdict("/insights/no-such-post")).toEqual({ verdict: "missing" });
    expect(await verdict("/careers/no-such-role")).toEqual({ verdict: "missing" });
    expect(await verdict("/insights/topics/none")).toEqual({ verdict: "missing" });
    const totalPages = (fixture("post-page") as { totalPages: number }).totalPages;
    expect(await verdict(`/insights/page/${totalPages + 1}`)).toEqual({ verdict: "missing" });
  });

  it("answers missing for a closed section, and when content is not configured", async () => {
    const closed = readersWith({ "/api/content/v1/site-state": fixture("site-state-closed") });
    expect(await verdict("/insights/example-post-1", closed)).toEqual({ verdict: "missing" });
    expect(await verdict("/careers", closed)).toEqual({ verdict: "missing" });
    const unconfigured = readersWith({}, false);
    expect(await unconfigured.siteState()).toEqual(CLOSED_SITE_STATE);
    expect(await verdict("/insights", unconfigured)).toEqual({ verdict: "missing" });
  });

  it("answers unavailable when the admin cannot be read", async () => {
    const down = readersWith({
      "/api/content/v1/insights/posts/example-post-1": new ContentUnavailableError("timeout"),
    });
    expect(await verdict("/insights/example-post-1", down)).toEqual({ verdict: "unavailable" });
    const stateDown = readersWith({
      "/api/content/v1/site-state": new ContentUnavailableError("network"),
    });
    expect(await verdict("/careers", stateDown)).toEqual({ verdict: "unavailable" });
  });
});

describe("createProxyLookup", () => {
  const ok: Verdict = { verdict: "ok" };
  const missing: Verdict = { verdict: "missing" };

  function make(answers: (Verdict | Error)[], options: { clock?: { t: number } } = {}) {
    const clock = options.clock ?? { t: 0 };
    const fetchVerdict = vi.fn(async () => {
      const next = answers.length > 1 ? answers.shift() : answers[0];
      if (next instanceof Error || next === undefined) throw next ?? new Error("none");
      return next;
    });
    const lookup = createProxyLookup({ fetchVerdict, now: () => clock.t, maxEntries: 3 });
    return { lookup, fetchVerdict, clock };
  }

  it("keeps a verdict for 30 s per path", async () => {
    const { lookup, fetchVerdict, clock } = make([ok]);
    expect(await lookup.verdict("/insights/a")).toEqual(ok);
    clock.t = 29_000;
    expect(await lookup.verdict("/insights/a")).toEqual(ok);
    expect(fetchVerdict).toHaveBeenCalledTimes(1);
    clock.t = 30_001;
    await lookup.verdict("/insights/a");
    expect(fetchVerdict).toHaveBeenCalledTimes(2);
  });

  it("confirms a 'missing' older than 3 s before trusting it", async () => {
    const { lookup, fetchVerdict, clock } = make([missing, ok]);
    expect(await lookup.verdict("/insights/new")).toEqual(missing);
    clock.t = 2_000;
    expect(await lookup.verdict("/insights/new")).toEqual(missing);
    expect(fetchVerdict).toHaveBeenCalledTimes(1);
    clock.t = 4_000;
    expect(await lookup.verdict("/insights/new")).toEqual(ok);
    expect(fetchVerdict).toHaveBeenCalledTimes(2);
  });

  it("keeps 'unavailable' for 5 s only", async () => {
    const { lookup, fetchVerdict, clock } = make([{ verdict: "unavailable" }, ok]);
    expect(await lookup.verdict("/insights/a")).toEqual({ verdict: "unavailable" });
    clock.t = 4_000;
    expect(await lookup.verdict("/insights/a")).toEqual({ verdict: "unavailable" });
    clock.t = 5_001;
    expect(await lookup.verdict("/insights/a")).toEqual(ok);
    expect(fetchVerdict).toHaveBeenCalledTimes(2);
  });

  it("passes through (null) on failure and remembers the failure briefly", async () => {
    const { lookup, fetchVerdict, clock } = make([new Error("down"), ok]);
    expect(await lookup.verdict("/insights/a")).toBeNull();
    clock.t = 1_000;
    expect(await lookup.verdict("/insights/a")).toBeNull();
    expect(fetchVerdict).toHaveBeenCalledTimes(1);
    clock.t = 5_001;
    expect(await lookup.verdict("/insights/a")).toEqual(ok);
  });

  it("passes through when the lookup times out", async () => {
    vi.useFakeTimers();
    try {
      const fetchVerdict = vi.fn(
        (_path: string, signal: AbortSignal) =>
          new Promise<Verdict>((_, reject) =>
            signal.addEventListener("abort", () => reject(new Error("aborted"))),
          ),
      );
      const lookup = createProxyLookup({ fetchVerdict, timeoutMs: 6_000 });
      const pending = lookup.verdict("/insights/slow");
      await vi.advanceTimersByTimeAsync(6_000);
      expect(await pending).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shares one lookup between concurrent requests, bounds the map and can be cleared", async () => {
    const { lookup, fetchVerdict } = make([ok]);
    await Promise.all([lookup.verdict("/a"), lookup.verdict("/a"), lookup.verdict("/a")]);
    expect(fetchVerdict).toHaveBeenCalledTimes(1);
    for (const path of ["/b", "/c", "/d", "/e"]) await lookup.verdict(path);
    expect(lookup.size()).toBe(3);
    lookup.clear();
    expect(lookup.size()).toBe(0);
  });

  it("only accepts well-formed verdicts from the route", () => {
    expect(VerdictSchema.safeParse({ verdict: "ok" }).success).toBe(true);
    expect(
      VerdictSchema.safeParse({ verdict: "redirect", location: "/insights/new-slug" }).success,
    ).toBe(true);
    for (const bad of [
      { verdict: "redirect", location: "https://evil.example/" },
      { verdict: "redirect", location: "//evil.example" },
      { verdict: "redirect", location: "/about" },
      { verdict: "redirect" },
      { verdict: "ok", extra: 1 },
      { verdict: "maybe" },
    ]) {
      expect(VerdictSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
