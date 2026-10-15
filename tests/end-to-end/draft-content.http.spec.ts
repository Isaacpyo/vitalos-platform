import { expect, test } from "@playwright/test";
import { isDraftRun } from "../support/content-source";
import { fetchAndCheckSitemap } from "../support/sitemap";

/**
 * Publication rules under the draft content source (ADR-025): the invented placeholder content opens
 * Work, Insights and Careers, but every placeholder page stays out of the sitemap and noindex, draft
 * legal pages stay out of the sitemap, and nothing is indexable.
 */
test.skip(!isDraftRun, "runs only against a server built with E2E_CONTENT_SOURCE=draft");

test("placeholder sections are served but never listed in the sitemap", async ({
  request,
  baseURL,
}) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  // Insights comes from the Super Admin (ADR-035) and is closed with no content API configured.
  // Careers too (ADR-035).
  expect((await request.get("/insights")).status()).toBe(404);
  expect((await request.get("/careers")).status()).toBe(404);
  for (const section of ["/work"]) {
    expect((await request.get(section)).status(), section).toBe(200);
    expect(paths.some((path) => path === section || path.startsWith(`${section}/`))).toBe(false);
  }
  for (const path of ["/work/connecting-field-and-warehouse-systems", "/people/alex-morgan"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).toContain("Placeholder — replace before launch");
  }
  expect(paths.some((path) => path.startsWith("/people/"))).toBe(false);
});

test("draft legal pages are served but never listed", async ({ request, baseURL }) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  expect(paths.filter((path) => path.startsWith("/legal/"))).toEqual([]);
  expect((await request.get("/legal/privacy")).status()).toBe(200);
});

test("the drafted commercial pages are listed", async ({ request, baseURL }) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  for (const path of [
    "/what-we-do/engineering",
    "/solutions/technology-recovery-reliability",
    "/offers/product-discovery",
    "/industries/growth-technology",
    "/labs/research/inherited-system-takeover-assessment",
    // The Labs gate is open and the type has assets, so its category page is listed.
    "/labs/research",
    "/trust/responsible-ai",
  ]) {
    expect(paths, path).toContain(path);
  }
});

test("a draft build is never indexable", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-robots-tag"]).toMatch(/noindex/);
});
