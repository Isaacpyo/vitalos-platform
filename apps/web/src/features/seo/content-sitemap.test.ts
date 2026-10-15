import { describe, expect, it } from "vitest";
import { mergeContentSitemap } from "./content-sitemap";

const site = "https://www.example.test";
const base = [
  { url: `${site}/` },
  { url: `${site}/what-we-do` },
  { url: `${site}/insights` },
  { url: `${site}/insights/cms-post` },
  { url: `${site}/careers` },
  { url: `${site}/careers/cms-role` },
];
const content = {
  entries: [
    { path: "/insights", lastModified: "2026-10-14T10:30:00Z" },
    { path: "/insights/example-post-1", lastModified: "2026-10-14T10:30:00Z" },
    { path: "/careers/example-role", lastModified: "2026-10-12T09:00:00Z" },
    { path: "/", lastModified: "2026-10-12T09:00:00Z" },
    { path: "/about", lastModified: "2026-10-12T09:00:00Z" },
    { path: "/insights/../admin", lastModified: "2026-10-12T09:00:00Z" },
  ],
};
const urls = (entries: { url: string }[]) => entries.map((entry) => entry.url);

describe("mergeContentSitemap", () => {
  it("replaces CMS Insights and Careers with the admin's entries once configured", () => {
    const merged = mergeContentSitemap(base, content, { siteUrl: site, contentConfigured: true });
    expect(urls(merged)).toEqual([
      `${site}/`,
      `${site}/what-we-do`,
      `${site}/insights`,
      `${site}/insights/example-post-1`,
      `${site}/careers/example-role`,
    ]);
    expect(merged.find((entry) => entry.url.endsWith("example-post-1"))?.lastModified).toEqual(
      new Date("2026-10-14T10:30:00Z"),
    );
  });

  it("is fail-soft: a failed read keeps the static entries (minus CMS Insights)", () => {
    expect(
      urls(mergeContentSitemap(base, null, { siteUrl: site, contentConfigured: true })),
    ).toEqual([`${site}/`, `${site}/what-we-do`]);
  });

  it("keeps the CMS Careers entries while the content API is not configured", () => {
    expect(
      urls(mergeContentSitemap(base, null, { siteUrl: site, contentConfigured: false })),
    ).toEqual([`${site}/`, `${site}/what-we-do`, `${site}/careers`, `${site}/careers/cms-role`]);
  });
});
