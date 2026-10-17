import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { templatePaths } from "../support/routes";

/**
 * A9 (fixed by WS1, verified by WS5): a reveal animation must never leave a heading clipped,
 * with motion allowed (after it has played) or reduced (it must not play at all). A heading is
 * clipped when an ancestor that hides overflow cuts into its box, or when it is still transparent.
 */

const sample = templatePaths("home", "practice", "solution", "offer", "industry");

async function clippedHeadings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    for (const heading of Array.from(document.querySelectorAll("main h1, main h2, main h3"))) {
      const rect = heading.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const name = (heading.textContent ?? "").trim().slice(0, 50);
      let opacity = 1;
      for (let el: Element | null = heading; el; el = el.parentElement) {
        opacity *= Number(getComputedStyle(el).opacity);
      }
      if (opacity < 0.99) problems.push(`"${name}" opacity ${opacity.toFixed(2)}`);
      for (let el = heading.parentElement; el && el !== document.body; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.overflowX === "visible" && style.overflowY === "visible") continue;
        const box = el.getBoundingClientRect();
        if (rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.left < box.left - 1 || rect.right > box.right + 1) {
          problems.push(`"${name}" is cut by ${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
          break;
        }
      }
    }
    return problems;
  });
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  });
}

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test.describe(`headings are never clipped by a reveal (A9, motion ${reducedMotion})`, () => {
    test.use({ reducedMotion });
    for (const path of sample) {
      test(`${path}: every heading is fully visible once revealed`, async ({ page }) => {
        await page.goto(path);
        await scrollThrough(page);
        // Let the last reveals finish (the longest reveal duration is well under a second).
        await page.waitForTimeout(reducedMotion === "reduce" ? 50 : 1200);
        expect(await clippedHeadings(page)).toEqual([]);
      });
    }
  });
}
