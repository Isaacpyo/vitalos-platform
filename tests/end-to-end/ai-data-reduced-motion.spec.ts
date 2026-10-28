import { expect, test } from "@playwright/test";

/**
 * Reduced motion on the AI & Data home page (ADR-023, ADR-024): the hero walkthrough still works,
 * expansion is effectively instant and nothing is animating.
 */
test.use({ reducedMotion: "reduce" });

test("expansion and hover transitions collapse to near zero, and stages still work", async ({
  page,
}) => {
  await page.goto("/ai-data");
  const hero = page.locator("#aid-hero-workflow");
  await hero.getByRole("button", { name: /^Next: Read/ }).click();
  await hero.getByRole("button", { name: /^Next: Check/ }).click();
  const row = hero.getByRole("button", { name: /INV-3102/ });
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll("#aid-hero-workflow .grid")]
      .map((el) => getComputedStyle(el).transitionDuration)
      .filter(Boolean),
  );
  expect(durations.length).toBeGreaterThan(0);
  for (const duration of durations) {
    for (const part of duration.split(",")) expect(parseFloat(part)).toBeLessThan(0.05);
  }
  // Nothing is animating in the hero.
  const running = await page.evaluate(
    () => document.getAnimations().filter((a) => a.playState === "running").length,
  );
  expect(running).toBe(0);
});
