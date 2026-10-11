import { expect, test } from "@playwright/test";
import { isDraftRun } from "../support/content-source";

/** The draft ribbon is server-rendered: visible with JavaScript disabled (ADR-025). */
test.skip(!isDraftRun, "runs only against a server built with E2E_CONTENT_SOURCE=draft");

for (const path of ["/", "/what-we-do/engineering", "/contact"]) {
  test(`${path}: the draft ribbon is visible without JavaScript`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("complementary", { name: "Draft content notice" })).toBeVisible();
  });
}
