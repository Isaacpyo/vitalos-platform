import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

test("keyboard skip link reaches main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("homepage has no WCAG 2.2 AA axe violations", async ({ page }) => {
  await page.goto("/");
  await expectNoA11yViolations(page);
});

test("homepage reflows at 320px without horizontal scrolling", async ({ page }) => {
  // Permanent gate for WCAG 2.2 SC 1.4.10 (reflow).
  await page.goto("/");
  await expectNoHorizontalOverflowAt320(page);
});
