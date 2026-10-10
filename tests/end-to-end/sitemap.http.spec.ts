import { expect, test } from "@playwright/test";
import { crawl } from "../support/crawl";
import { GATED_PREFIXES, TEMPLATES, isGatedPath } from "../support/routes";
import { fetchAndCheckSitemap } from "../support/sitemap";

/**
 * sitemap.xml and the internal-link crawl against the `full` fixture set (every publication gate
 * open). The sparse counterpart is sitemap.sparse.spec.ts. Runs in the `http` project.
 */

test("sitemap.xml is valid, lists only live pages and covers every template", async ({
  request,
  baseURL,
}) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  const listed = new Set(paths);

  // With every gate open, each template is indexable (the manifest uses live fixture slugs).
  for (const template of TEMPLATES.filter((entry) => entry.inSitemap !== false)) {
    expect(listed.has(template.path), `${template.path} (${template.name}) is listed`).toBe(true);
  }
  // Gated sections are listed because their gates are open in this set.
  for (const prefix of GATED_PREFIXES) {
    expect(
      paths.some((path) => path === prefix || path.startsWith(`${prefix}/`)),
      `${prefix} is listed while its gate is open`,
    ).toBe(true);
  }
});

test("content that is not publishable is neither listed nor served", async ({
  request,
  baseURL,
}) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  // Pending case study (no verified evidence): not a page at all (proof.spec.ts asserts the 404).
  expect(paths).not.toContain("/work/example-case-study-pending");
  expect((await request.get("/work/example-case-study-pending")).status()).toBe(404);
  // Legal pages the site links to exist in the sitemap.
  expect(paths).toContain("/legal/privacy");
});

test("closed roles are not listed but keep their page; open roles and lab types are listed", async ({
  request,
  baseURL,
}) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  expect(paths).toContain("/careers/example-role");
  expect(paths).not.toContain("/careers/example-closed-role");
  expect((await request.get("/careers/example-closed-role")).status()).toBe(200);
  // The Labs gate is open and the type has assets, so its category page is listed (and serves 200,
  // which fetchAndCheckSitemap asserts for every listed URL).
  expect(paths).toContain("/labs/open-source");
});

test("every internal link reachable from the home page and the sitemap resolves", async ({
  request,
  baseURL,
}) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  const result = await crawl(request, ["/", ...paths]);
  expect(result.failures, "dead or broken internal links").toEqual([]);
  // The crawl must actually reach the whole site, not stop at the seeds.
  expect(result.statuses.size).toBeGreaterThanOrEqual(paths.length);
  for (const path of paths.filter(isGatedPath)) expect(result.statuses.get(path)).toBe(200);
});
