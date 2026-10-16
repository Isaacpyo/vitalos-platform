import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";
import { isDraftRun } from "../support/content-source";

// The podcast page (owner direction, 16 Oct 2026). The full fixture set has podcast URLs; the
// draft source has none, so the page does not exist there.
test.skip(isDraftRun, "the draft source has no podcast URLs");

test.describe("Podcast page", () => {
  test("shows a few words and opens each listening app in a new tab", async ({ page }) => {
    const response = await page.goto("/podcast");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Vitalos podcast");
    const main = page.locator("main");
    const spotify = main.getByRole("link", { name: /Listen on Spotify/ });
    const apple = main.getByRole("link", { name: /Listen on Apple Podcasts/ });
    await expect(spotify).toHaveAttribute("href", /^https:\/\/open\.spotify\.com\//);
    await expect(apple).toHaveAttribute("href", /^https:\/\/podcasts\.apple\.com\//);
    for (const link of [spotify, apple]) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflowAt320(page);
  });

  test("the footer's podcast links lead to the podcast page", async ({ page }) => {
    await page.goto("/");
    // Collapsed footer columns on mobile hide the links from role queries: check the targets.
    await expect(page.locator('footer a[href="/podcast"]')).toHaveCount(2);
  });
});
