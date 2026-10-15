import { test } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { CAREERS_PAGES, stubMedia } from "./support/media";

/** axe (WCAG 2.2 AA) on every Careers page, including the role page's form. */
for (const { name, path } of CAREERS_PAGES) {
  test(`axe: ${name}`, async ({ page }) => {
    await stubMedia(page);
    await page.goto(path);
    await expectNoA11yViolations(page);
  });
}

test("axe: the form with its errors shown", async ({ page }) => {
  await page.goto("/careers/example-role-fixture");
  await page.getByRole("button", { name: "Send application" }).click();
  await page.locator("main").getByRole("alert").waitFor();
  await expectNoA11yViolations(page);
});
