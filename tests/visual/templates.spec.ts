import { expect, test } from "@playwright/test";
import { waitForSettledLayout } from "../support/overflow";
import { TEMPLATES } from "../support/routes";

/**
 * Full-page screenshot of every page template under the `full` fixtures (ADR-021 decision 7).
 * Non-gating; see tests/visual/README.md.
 *
 * Determinism: reduced motion and disabled animations (config), fonts awaited, layout settled,
 * the Turnstile iframe masked (Cloudflare's document, not ours), horizontally scrolled regions
 * (carousels) returned to their start, and any <time> element masked so a date cannot flake a
 * baseline.
 */
const slug = (value: string) => value.replace(/\s+/g, "-");

for (const template of TEMPLATES) {
  test(slug(template.name), async ({ page }, testInfo) => {
    const response = await page.goto(template.path, { waitUntil: "load" });
    expect(response?.status(), template.path).toBe(200);

    await page.evaluate(() => document.fonts.ready);
    // Lazy images load on scroll; walk the page once so the full-page capture has every image.
    await page.evaluate(async () => {
      const step = Math.max(window.innerHeight - 100, 200);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
      for (const element of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        if (element.scrollLeft !== 0) element.scrollLeft = 0;
      }
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.complete ? undefined : image.decode().catch(() => undefined),
        ),
      );
    });
    await page.evaluate(() => document.fonts.ready);
    await waitForSettledLayout(page);

    await expect(page).toHaveScreenshot(`${slug(template.name)}.png`, {
      fullPage: true,
      mask: [
        page.locator('iframe[src*="challenges.cloudflare.com"]'),
        page.locator(".cf-turnstile"),
        page.locator("time"),
      ],
    });
    testInfo.annotations.push({ type: "path", description: template.path });
  });
}
