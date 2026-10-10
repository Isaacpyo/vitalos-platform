import { expect, test } from "@playwright/test";
import { crawl } from "../support/crawl";
import { GATED_PREFIXES } from "../support/routes";
import { fetchAndCheckSitemap } from "../support/sitemap";

/**
 * sitemap.xml and the internal-link crawl against the `sparse` fixture set, which sits below every
 * publication gate (ADR-022). Needs the sparse server (see playwright.config.ts).
 */

test("the sitemap is valid and lists nothing from a closed gate", async ({ request, baseURL }) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  expect(paths).toContain("/");
  for (const prefix of GATED_PREFIXES) {
    expect(
      paths.filter((path) => path === prefix || path.startsWith(`${prefix}/`)),
      `${prefix} is absent while its gate is closed`,
    ).toEqual([]);
  }
  // Ungated documents are still listed. Index pages are listed only when their route-page
  // document exists, and the sparse set has none, so they are absent (and still served).
  for (const path of ["/what-we-do/example-practice", "/offers/example-offer"]) {
    expect(paths, path).toContain(path);
  }
});

test("gated indexes 404 and are linked from nowhere", async ({ request, baseURL }) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  for (const index of GATED_PREFIXES) {
    expect((await request.get(index)).status(), `${index} is closed`).toBe(404);
  }
  const result = await crawl(request, ["/", ...paths]);
  // Every internal link on every reachable page resolves: nothing points into a closed gate.
  expect(result.failures, "dead or gated internal links").toEqual([]);
});

test("a detail page below its gate stays reachable but is not listed", async ({
  request,
  baseURL,
}) => {
  const { paths } = await fetchAndCheckSitemap(request, new URL(baseURL as string).origin);
  expect(paths).not.toContain("/work/example-case-study");
  // The sparse set keeps one verified case study and two insights (proof.sparse.spec.ts).
  const response = await request.get("/work/example-case-study");
  expect(response.status()).toBe(200);
});
