import { test } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { INSIGHTS_PAGES, stubMedia } from "./support/media";

/** axe (WCAG 2.2 AA) on every Insights page and the homepage with its Insights section. */
for (const { name, path } of INSIGHTS_PAGES) {
  test(`axe: ${name}`, async ({ page }) => {
    await stubMedia(page);
    await page.goto(path);
    await expectNoA11yViolations(page);
  });
}
