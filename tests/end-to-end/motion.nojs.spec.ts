import { expect, test } from "@playwright/test";
import { isDraftRun } from "../support/content-source";

/**
 * Runs in the `no-js` project (JavaScript disabled). The motion islands (ADR-024) must never be
 * what makes content visible: the server HTML is the final, visible state.
 */
const fixtureRoutes = [
  "/",
  "/what-we-do/example-practice",
  "/solutions/example-solution",
  "/offers/example-offer",
  "/industries/example-industry",
  "/how-we-work",
  "/insights",
  "/insights/example-insight-1",
  "/work",
  "/labs",
  "/labs/open-source/example-open-source-tool",
  "/trust/security",
  "/about",
  "/contact",
];

/**
 * The same templates under the draft source (ADR-025). Work and Insights have no draft content and
 * their gates are closed, so those pages do not exist there.
 */
const draftRoutes = [
  "/",
  "/what-we-do/engineering",
  "/solutions/ai-transformation",
  "/offers/ai-opportunity-assessment",
  "/industries/health-care",
  "/how-we-work",
  "/labs",
  "/labs/research/production-ai-evaluation-harness",
  "/trust/security",
  "/about",
  "/contact",
];

const routes = isDraftRun ? draftRoutes : fixtureRoutes;

for (const path of routes) {
  test(`${path}: the server HTML hides nothing for an entrance`, async ({ request }) => {
    const html = await (await request.get(path)).text();
    // No inline style may start content invisible, clipped away or held back.
    expect(html).not.toMatch(/style="[^"]*opacity:\s*0(?![.\d])/);
    expect(html).not.toMatch(/style="[^"]*visibility:\s*hidden/);
    expect(html).not.toMatch(/style="[^"]*clip-path:\s*inset\([^)]*100%/);
    expect(html).not.toMatch(/data-reveal-state="(hidden|shown)"/);
  });

  test(`${path}: every piece of text is drawn at full opacity without JavaScript`, async ({
    page,
  }) => {
    await page.goto(path);
    // Let the CSS-only load motion (hero planes, headline settle) finish.
    await page.waitForTimeout(1000);
    const faint = await page.evaluate(() => {
      const problems: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        const parent = node.parentElement;
        if (!text || !parent || parent.closest("script, style, template, noscript")) continue;
        // Closed menus and visually hidden copies are not drawn at all; skip what has no box.
        if (parent.getClientRects().length === 0 || parent.closest(".sr-only")) continue;
        let opacity = 1;
        for (let element: Element | null = parent; element; element = element.parentElement) {
          const style = getComputedStyle(element);
          opacity *= Number(style.opacity);
          if (style.visibility === "hidden") opacity = 0;
        }
        if (opacity < 1) problems.push(`${text.slice(0, 40)} (opacity ${opacity.toFixed(2)})`);
      }
      return problems.slice(0, 8);
    });
    expect(faint).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("the compact menu still opens and closes as a native disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const header = page.getByRole("banner");
  const nav = header.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeHidden();
  await header.locator("summary", { hasText: "Menu" }).click();
  await expect(nav).toBeVisible();
  // About sits in the Who We Are disclosure, itself a native <details>.
  await nav.locator("summary", { hasText: "Who We Are" }).first().click();
  await expect(nav.getByRole("link", { name: "About", exact: true })).toBeVisible();
  await header.locator("summary", { hasText: "Menu" }).click();
  await expect(nav).toBeHidden();
});
