import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

/**
 * Proof and authority templates below their publication gates (workstream G2b).
 *
 * Runs in the `sparse` Playwright project against a server built with VITALOS_FIXTURE_SET=sparse
 * (Work 1 verified case study, Insights 2, Labs 0): the gates are closed, so the indexes do not
 * exist, detail pages stay reachable but are not indexed, and nothing links to a missing page.
 * Enable with:  E2E_FIXTURE_SET=sparse E2E_SPARSE_BASE_URL=http://127.0.0.1:3210 \
 *               pnpm exec playwright test --project=sparse
 *
 * The local deploy environment is non-indexable as a whole, so every page carries `noindex` here;
 * the gate-specific noindex decision is asserted in
 * apps/web/src/templates/institutional/gated-metadata.test.ts.
 */

/**
 * Sections owned by other workstreams (G2a: commercial templates) that do not exist on this
 * branch until the workstreams are integrated. Links into them are not checked here.
 */
const OWNED_ELSEWHERE = ["/what-we-do", "/solutions", "/offers", "/industries", "/how-we-work"];

async function internalLinks(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator("a[href^='/']")
    .evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href") ?? ""));
  return [...new Set(hrefs.map((href) => href.split("#")[0]!.split("?")[0]!))].filter(
    (path) => path !== "" && !OWNED_ELSEWHERE.some((prefix) => path.startsWith(prefix)),
  );
}

async function expectNoDeadLinks(page: Page) {
  for (const path of await internalLinks(page)) {
    const response = await page.request.get(path);
    expect(response.status(), `${path} linked from ${page.url()}`).toBeLessThan(400);
  }
}

test.describe("gated indexes do not exist below their gate", () => {
  for (const path of ["/work", "/insights", "/labs", "/labs/research", "/careers"]) {
    test(`${path} is a 404`, async ({ page }) => {
      expect((await page.goto(path))?.status()).toBe(404);
    });
  }
});

test.describe("detail pages stay reachable but are not indexed", () => {
  test("a case study renders from its own fields only", async ({ page }) => {
    const response = await page.goto("/work/example-case-study");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // No metrics, no testimonial, no sector: nothing is invented to fill the page.
    await expect(page.locator('ul[aria-label="Outcome"]')).toHaveCount(0);
    await expect(page.locator("blockquote")).toHaveCount(0);
    await expect(page.getByText("Anonymised", { exact: true })).toBeVisible();
    // The Work index does not exist, so the breadcrumb does not link to it.
    await expect(page.locator('nav[aria-label="Breadcrumb"] a[href="/work"]')).toHaveCount(0);
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflowAt320(page);
    await expectNoDeadLinks(page);
  });

  test("a profile with almost no data renders and links only to existing pages", async ({
    page,
  }) => {
    const response = await page.goto("/people/example-person");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    // The closing card ends every page (pages redesign); no content section may be empty.
    await expect(
      page
        .locator("main")
        .getByRole("heading", { level: 2 })
        .filter({ hasNotText: "Have a problem worth solving?" }),
    ).toHaveCount(0);
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflowAt320(page);
    await expectNoDeadLinks(page);
  });
});
