import { expect, test } from "@playwright/test";
import { isDraftRun } from "../support/content-source";
import { fetchAndCheckSitemap } from "../support/sitemap";

/**
 * Publication rules under the draft content source (ADR-025): sections without draft content keep
 * their gates closed, draft legal pages stay out of the sitemap, and nothing is indexable.
 */
test.skip(!isDraftRun, "runs only against a server built with E2E_CONTENT_SOURCE=draft");

test("sections with no draft content answer 404 and stay out of the sitemap", async ({
  request,
  baseURL,
}) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  for (const closed of ["/work", "/insights", "/careers"]) {
    expect((await request.get(closed)).status(), closed).toBe(404);
    expect(paths.some((path) => path === closed || path.startsWith(`${closed}/`))).toBe(false);
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
