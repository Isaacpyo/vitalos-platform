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
  // KNOWN DEFECT in the interim W0 shell: the single-row header (wordmark, nav, utility link and
  // CTA in `flex` without wrapping) is about 420px wide, so the page scrolls sideways at 320px
  // (WCAG 2.2 SC 1.4.10). The shell is replaced by SiteHeader/MobileNav in workstreams B and G2a.
  // `test.fail` keeps the suite green while the defect exists and turns RED when it is fixed, so
  // this annotation must then be deleted and the assertion becomes a permanent gate.
  test.fail(true, "Interim shell header overflows at 320px; fixed by workstreams B and G2a");
  await page.goto("/");
  await expectNoHorizontalOverflowAt320(page);
});
