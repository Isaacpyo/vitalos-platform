import { describe, expect, it } from "vitest";
import { aiDataSitemapPaths, brandName } from "@vitalos/cms";
import { seoSite } from "../seo/site";
import { aiDataSeo } from "./seo";

describe("AI & Data page metadata (ADR-043 limits)", () => {
  const pages = Object.entries(aiDataSeo);

  it.each(pages)("%s: title within %s characters with the template", (_key, page) => {
    expect(`${page.title} | ${brandName}`.length).toBeLessThanOrEqual(seoSite.limits.titleMax);
  });

  it.each(pages)("%s: description within the length limits", (_key, page) => {
    expect(page.description.length).toBeGreaterThanOrEqual(seoSite.limits.descriptionMin);
    expect(page.description.length).toBeLessThanOrEqual(seoSite.limits.descriptionMax);
  });

  it("has unique titles and descriptions, one per sitemap path", () => {
    expect(new Set(pages.map(([, page]) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map(([, page]) => page.description)).size).toBe(pages.length);
    expect(pages.map(([, page]) => page.path).sort()).toEqual([...aiDataSitemapPaths].sort());
  });

  it("makes no unsupported claims in metadata", () => {
    const text = JSON.stringify(aiDataSeo).toLowerCase();
    for (const word of ["certified", "guarantee", "24/7", "world-leading", "clients save"]) {
      expect(text).not.toContain(word);
    }
  });
});
