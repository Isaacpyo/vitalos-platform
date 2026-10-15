import { expect, test } from "@playwright/test";
import { waitForSettledLayout } from "../support/overflow";
import { INSIGHTS_PAGES, stubMedia } from "./support/media";

/**
 * Screenshots of every Insights page and the homepage section at 1440, 768 and 390 CSS px, in
 * light and dark colour schemes (brief 13). The site has no dark theme yet, so the dark captures
 * record that the pages stay legible under `prefers-color-scheme: dark`.
 */
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

for (const scheme of ["light", "dark"] as const) {
  for (const viewport of viewports) {
    test.describe(`${scheme} ${viewport.width}`, () => {
      test.use({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
      for (const { name, path } of INSIGHTS_PAGES) {
        test(name, async ({ page }) => {
          await stubMedia(page);
          await page.goto(path, { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          await waitForSettledLayout(page);
          await expect(page).toHaveScreenshot(`${name}-${scheme}-${viewport.width}.png`, {
            fullPage: true,
          });
        });
      }
    });
  }
}
