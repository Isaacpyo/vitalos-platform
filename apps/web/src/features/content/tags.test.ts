import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isKnownPath,
  isKnownTag,
  readNames,
  tagsContract,
  tagsForRead,
  withSitemapChildren,
} from "./tags";

const raw = JSON.parse(
  readFileSync(
    new URL("../../../../../contracts/content-api/v1/tags.json", import.meta.url),
    "utf8",
  ),
) as typeof tagsContract;

describe("tags contract", () => {
  it("is the committed tags.json, imported rather than copied", () => {
    expect(tagsContract).toEqual(raw);
    expect(Object.keys(raw.reads).sort()).toEqual([...readNames].sort());
  });

  it("fills {slug} for detail reads and refuses an invalid slug", () => {
    expect(tagsForRead("insights/posts/{slug}", { slug: "example-post-1" })).toEqual([
      "insights",
      "insights:post:example-post-1",
    ]);
    expect(tagsForRead("careers/roles/{slug}", { slug: "a-role" })).toEqual([
      "careers",
      "careers:role:a-role",
    ]);
    expect(tagsForRead("site-state")).toEqual(["site"]);
    expect(() => tagsForRead("insights/posts/{slug}")).toThrow();
    expect(() => tagsForRead("insights/posts/{slug}", { slug: "Bad" })).toThrow();
  });

  it("every tag an event emits is a known tag once expanded", () => {
    const events = (raw as unknown as { events: Record<string, { tags: string[] }> }).events;
    for (const [name, event] of Object.entries(events)) {
      for (const template of event.tags) {
        const tag = template.replaceAll("*", "").replace(/\{[a-zA-Z]+\}/g, "example-slug");
        expect(isKnownTag(tag), `${name}: ${tag}`).toBe(true);
      }
    }
  });

  it("accepts known tags and refuses everything else", () => {
    for (const tag of [
      "site",
      "insights",
      "insights:list",
      "insights:post:a-1",
      "insights:author:x",
      "insights:topic:x",
      "careers",
      "careers:list",
      "careers:role:y",
      "home",
      "feed",
      "sitemap",
    ]) {
      expect(isKnownTag(tag), tag).toBe(true);
    }
    for (const tag of [
      "",
      "Insights",
      "unknown",
      "insights:post",
      "insights:post:UPPER",
      "insights:post:a b",
      "insights:post:a:b",
      "careers:job:x",
      "site-state",
      `insights:post:${"a".repeat(81)}`,
      "home ",
      "_next",
    ]) {
      expect(isKnownTag(tag), tag).toBe(false);
    }
  });

  it("accepts the contract's path patterns and refuses everything else", () => {
    for (const path of [
      "/",
      "/insights",
      "/insights/page/2",
      "/insights/feed.xml",
      "/insights/example-post",
      "/insights/authors/example-author",
      "/insights/topics/example-topic",
      "/careers",
      "/careers/example-role",
      "/sitemap.xml",
    ]) {
      expect(isKnownPath(path), path).toBe(true);
    }
    for (const path of [
      "",
      "insights",
      "/insights/",
      "/insights/page/0",
      "/insights/page/10000",
      "/insights/a/b/c",
      "/about",
      "/api/content/revalidate",
      "/insights/../admin",
      "/insights/UPPER",
      "/careers/x?y=1",
      "https://evil.example/insights",
      "//evil.example/insights",
    ]) {
      expect(isKnownPath(path), path).toBe(false);
    }
  });
});

describe("sitemap children (ADR-043)", () => {
  it("accepts the Insights and Careers sitemap files as revalidate paths, nothing else there", () => {
    expect(isKnownPath("/sitemaps/insights.xml")).toBe(true);
    expect(isKnownPath("/sitemaps/careers.xml")).toBe(true);
    expect(isKnownPath("/sitemaps/pages.xml")).toBe(false);
    expect(isKnownPath("/sitemaps/other.xml")).toBe(false);
  });

  it("adds both children wherever the index is named, once", () => {
    expect(withSitemapChildren(["/insights/a", "/sitemap.xml", "/sitemaps/careers.xml"])).toEqual([
      "/insights/a",
      "/sitemap.xml",
      "/sitemaps/careers.xml",
      "/sitemaps/insights.xml",
    ]);
    expect(withSitemapChildren(["/insights/a", "/insights/a"])).toEqual(["/insights/a"]);
  });
});
