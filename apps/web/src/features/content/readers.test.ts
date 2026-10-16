import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ContentNotFoundError, ContentUnavailableError } from "./client";
import type { ContentClient } from "./client";
import { CLOSED_SITE_STATE, createReaders } from "./readers";
import type { CacheFunction } from "./readers";
import { readNames, tagsContract } from "./tags";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../contracts/content-api/v1/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  );

/** Path (without query) -> fixture the fake admin answers with. */
const routes: Record<string, string> = {
  "/api/content/v1/site-state": "site-state",
  "/api/content/v1/insights/posts": "post-page",
  "/api/content/v1/insights/posts/example-post-1": "post-detail",
  "/api/content/v1/insights/posts/old-slug": "redirect",
  "/api/content/v1/insights/authors/example-author": "author",
  "/api/content/v1/insights/topics": "topics",
  "/api/content/v1/insights/topics/example-topic": "topic",
  "/api/content/v1/insights/feed": "feed",
  "/api/content/v1/careers/page": "careers-page",
  "/api/content/v1/careers/roles/example-role-fixture": "role-open",
  "/api/content/v1/home": "home",
  "/api/content/v1/sitemap": "sitemap",
};

function fakeClient(overrides: { fail?: boolean } = {}) {
  const get = vi.fn(async (pathAndQuery: string, schema: { parse(v: unknown): unknown }) => {
    if (overrides.fail) throw new ContentUnavailableError("network");
    const name = routes[pathAndQuery.split("?")[0] ?? ""];
    if (!name) throw new ContentNotFoundError();
    return schema.parse(fixture(name));
  });
  return { get, post: vi.fn() } as unknown as ContentClient & { get: typeof get };
}

/** Mirrors `unstable_cache`: memoises resolved values by key, stores nothing when `fn` throws. */
function fakeCache() {
  const store = new Map<string, unknown>();
  const calls: { keyParts: string[]; tags: string[]; revalidate: number }[] = [];
  const cache: CacheFunction = (fn, keyParts, options) => {
    calls.push({ keyParts, ...options });
    const key = JSON.stringify(keyParts);
    return async () => {
      if (store.has(key)) return store.get(key) as Awaited<ReturnType<typeof fn>>;
      const value = await fn();
      store.set(key, value);
      return value;
    };
  };
  return { cache, calls, store };
}

describe("content readers", () => {
  it("tags every read with exactly the tags in tags.json and the configured TTL", async () => {
    const { cache, calls } = fakeCache();
    const readers = createReaders({ client: fakeClient(), cache, ttlSeconds: 600 });
    await readers.siteState();
    await readers.listPosts({ page: 2, format: "guide" });
    await readers.post("example-post-1");
    await readers.author("example-author");
    await readers.topics();
    await readers.topic("example-topic", 2);
    await readers.feed();
    await readers.careersPage();
    await readers.role("example-role-fixture");
    await readers.home();
    await readers.sitemap();

    const byRead = new Map(calls.map((call) => [call.keyParts[2], call]));
    expect([...byRead.keys()].sort()).toEqual([...readNames].sort());
    expect(Object.keys(tagsContract.reads).sort()).toEqual([...readNames].sort());
    const slugs: Record<string, string> = {
      "insights/posts/{slug}": "example-post-1",
      "insights/authors/{slug}": "example-author",
      "insights/topics/{slug}": "example-topic",
      "careers/roles/{slug}": "example-role-fixture",
    };
    for (const [read, templates] of Object.entries(tagsContract.reads)) {
      const expected = templates.map((tag) => tag.replace("{slug}", slugs[read] ?? ""));
      expect(byRead.get(read)?.tags, read).toEqual(expected);
      expect(byRead.get(read)?.revalidate, read).toBe(600);
    }
  });

  it("keys reads by endpoint and parameters", async () => {
    const { cache, calls } = fakeCache();
    const client = fakeClient();
    const readers = createReaders({ client, cache, ttlSeconds: 600 });
    await readers.listPosts({ page: 2, topic: "example-topic" });
    await readers.listPosts({ page: 3 });
    await readers.listPosts({ page: 2, topic: "example-topic" });
    expect(calls[0]!.keyParts).not.toEqual(calls[1]!.keyParts);
    expect(calls[0]!.keyParts).toEqual(calls[2]!.keyParts);
    // The third read is served from the cache.
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.get.mock.calls[0]![0]).toBe(
      "/api/content/v1/insights/posts?page=2&topic=example-topic",
    );
  });

  it("caches a 404 as missing", async () => {
    const { cache, store } = fakeCache();
    const client = fakeClient();
    const readers = createReaders({ client, cache, ttlSeconds: 600 });
    expect(await readers.post("no-such-post")).toEqual({ kind: "missing" });
    expect(await readers.post("no-such-post")).toEqual({ kind: "missing" });
    expect(client.get).toHaveBeenCalledTimes(1);
    expect([...store.values()]).toEqual([{ kind: "missing" }]);
  });

  it("returns redirects and data as ok", async () => {
    const readers = createReaders({ client: fakeClient(), ...fakeCache(), ttlSeconds: 600 });
    expect(await readers.post("old-slug")).toEqual({
      kind: "ok",
      data: { redirect: "example-post-1" },
    });
    const post = await readers.post("example-post-1");
    expect(post.kind === "ok" && "slug" in post.data && post.data.slug).toBe("example-post-1");
  });

  it("throws on a failed read and caches nothing, so the next read tries again", async () => {
    const { cache, store } = fakeCache();
    const readers = createReaders({ client: fakeClient({ fail: true }), cache, ttlSeconds: 600 });
    await expect(readers.home()).rejects.toBeInstanceOf(ContentUnavailableError);
    await expect(readers.siteState()).rejects.toBeInstanceOf(ContentUnavailableError);
    expect(store.size).toBe(0);
  });

  it("never requests an invalid slug or page", async () => {
    const client = fakeClient();
    const readers = createReaders({ client, ...fakeCache(), ttlSeconds: 600 });
    for (const slug of ["../admin", "UPPER", "a b", "", "x".repeat(81), "a--b"]) {
      expect(await readers.post(slug), slug).toEqual({ kind: "missing" });
      expect(await readers.role(slug), slug).toEqual({ kind: "missing" });
    }
    expect(await readers.listPosts({ page: 0 })).toEqual({ kind: "missing" });
    expect(await readers.listPosts({ page: 1.5 })).toEqual({ kind: "missing" });
    expect(await readers.listPosts({ topic: "Bad Topic" })).toEqual({ kind: "missing" });
    expect(await readers.topic("example-topic", 10_000)).toEqual({ kind: "missing" });
    expect(client.get).not.toHaveBeenCalled();
  });

  it("is closed and silent when the content API is not configured", async () => {
    const { cache, calls } = fakeCache();
    const readers = createReaders({ client: null, cache, ttlSeconds: 600 });
    expect(readers.configured).toBe(false);
    expect(await readers.siteState()).toEqual(CLOSED_SITE_STATE);
    expect(await readers.home()).toEqual({ kind: "missing" });
    expect(await readers.readPreview("post", "00000000-0000-4000-8000-000000000101", "t")).toEqual({
      kind: "missing",
    });
    expect(calls).toHaveLength(0);
  });

  it("reads previews uncached, with the token header and the read scope", async () => {
    const { cache, calls } = fakeCache();
    const client = fakeClient();
    client.get.mockImplementation(async (_path, schema) => schema.parse(fixture("preview-post")));
    const readers = createReaders({ client, cache, ttlSeconds: 600 });
    const result = await readers.readPreview("post", "00000000-0000-4000-8000-000000000101", "tok");
    expect(result.kind).toBe("ok");
    expect(calls).toHaveLength(0);
    expect(client.get.mock.calls[0]![0]).toBe(
      "/api/content/v1/preview/post/00000000-0000-4000-8000-000000000101",
    );
    expect((client.get.mock.calls[0] as unknown[])[2]).toEqual({
      scope: "read",
      headers: { "x-vitalos-preview-token": "tok" },
    });
    expect(await readers.readPreview("post", "not-a-uuid", "tok")).toEqual({ kind: "missing" });
  });
});
