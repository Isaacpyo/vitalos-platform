import { expect, test } from "@playwright/test";
import { FIXTURE_SPECIFIC, isDraftRun } from "../support/content-source";

/**
 * Progressive enhancement for the proof templates (workstream G2b). Runs with JavaScript disabled:
 * the lists are complete and crawlable, and the client-side filters and the code-copy button,
 * which need JavaScript, are absent rather than dead.
 */

// Reads the fixture Work, Labs and Insights documents (ADR-025: none of these exist as such in
// the draft set; draft-content.nojs.spec.ts covers the draft source without JavaScript).
test.skip(isDraftRun, FIXTURE_SPECIFIC);

test("work index lists every verified case study with no filter controls", async ({ page }) => {
  await page.goto("/work");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator('main a[href^="/work/"]')).toHaveCount(2);
  await expect(page.locator("main select")).toHaveCount(0);
  await expect(page.locator("main [hidden]")).toHaveCount(0);
});

test("labs index lists every asset and its maturity with no filter controls", async ({ page }) => {
  await page.goto("/labs");
  await expect(page.locator("[data-maturity]")).toHaveCount(2);
  await expect(page.locator("main select")).toHaveCount(0);
});

test("an article renders its content and author without JavaScript", async ({ page }) => {
  await page.goto("/insights/example-insight-1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Artificial article body (fixture)")).toBeVisible();
  await expect(page.locator("main button")).toHaveCount(0);
});
