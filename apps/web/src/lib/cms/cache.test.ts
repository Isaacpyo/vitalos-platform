import { describe, expect, it, vi } from "vitest";
import { createSanityFetcher, REVALIDATE_SECONDS } from "./fetch";
import type { SanityClientLike } from "./fetch";
import { CMS_ROOT_TAG, MAX_TAG_LENGTH, normaliseTags, tagsForDocument } from "./tags";

describe("cache tags", () => {
  it("always puts the root tag first and removes duplicates", () => {
    expect(normaliseTags(["sanity:practice", "sanity", "sanity:practice"])).toEqual([
      CMS_ROOT_TAG,
      "sanity:practice",
    ]);
    expect(normaliseTags()).toEqual([CMS_ROOT_TAG]);
  });

  it("drops empty and oversized tags (Next.js ignores tags over 256 characters)", () => {
    expect(normaliseTags(["", "x".repeat(MAX_TAG_LENGTH + 1), "ok"])).toEqual([CMS_ROOT_TAG, "ok"]);
  });

  it("builds type and document tags from plain identifiers only", () => {
    expect(tagsForDocument("practice", "ai-and-data")).toEqual([
      "sanity",
      "sanity:practice",
      "sanity:practice:ai-and-data",
    ]);
    expect(tagsForDocument("practice", undefined)).toEqual(["sanity", "sanity:practice"]);
  });

  it("never echoes unsafe webhook input into a tag", () => {
    expect(tagsForDocument("pra ctice\n", "x")).toEqual(["sanity"]);
    expect(tagsForDocument("practice", "../etc")).toEqual(["sanity", "sanity:practice"]);
    expect(tagsForDocument(42, {})).toEqual(["sanity"]);
  });
});

describe("createSanityFetcher", () => {
  const fakeClient = (result: unknown): SanityClientLike & { fetch: ReturnType<typeof vi.fn> } => ({
    fetch: vi.fn().mockResolvedValue(result),
  });

  it("reads published content with force-cache, tags and a time-based safety net", async () => {
    const published = fakeClient({ ok: true });
    const fetcher = createSanityFetcher({ published });
    const result = await fetcher(
      "*[_type == 'practice']",
      { slug: "a" },
      { tags: ["sanity:practice"] },
    );
    expect(result).toEqual({ ok: true });
    expect(published.fetch).toHaveBeenCalledWith(
      "*[_type == 'practice']",
      { slug: "a" },
      {
        cache: "force-cache",
        next: { tags: ["sanity", "sanity:practice"], revalidate: REVALIDATE_SECONDS },
      },
    );
  });

  it("reads drafts without caching when previewing with a draft client", async () => {
    const published = fakeClient(null);
    const draft = fakeClient({ draft: true });
    const fetcher = createSanityFetcher({ published, draft });
    expect(await fetcher("q", {}, { preview: true })).toEqual({ draft: true });
    expect(draft.fetch).toHaveBeenCalledWith("q", {}, { cache: "no-store" });
    expect(published.fetch).not.toHaveBeenCalled();
  });

  it("falls back to published content when previewing without a draft client", async () => {
    const published = fakeClient({ published: true });
    const fetcher = createSanityFetcher({ published });
    expect(await fetcher("q", {}, { preview: true })).toEqual({ published: true });
    expect(published.fetch).toHaveBeenCalledOnce();
  });
});
