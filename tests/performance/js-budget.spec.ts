import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { budgetFor, expectWithinJsBudget, loadBudgets } from "../support/budgets";
import { NOT_FOUND_PATH, TEMPLATES } from "../support/routes";

// Client JavaScript budgets (ADR-021). Every route with an explicit budget is measured, so the
// list never drifts from the file, and a guard test fails when a template in the route manifest
// has no explicit entry (it would silently fall back to the generous default).
const budgets = loadBudgets();
const routes = Object.keys(budgets.routes);

test("every page template has its own JavaScript budget", () => {
  const missing = [...TEMPLATES.map((template) => template.path), NOT_FOUND_PATH].filter(
    (path) => budgets.routes[path] === undefined,
  );
  expect(
    missing,
    "add these routes to tests/performance/budgets.json (measure, then +~8%)",
  ).toEqual([]);
  expect(budgetFor("/__unlisted__").maxJsGzipBytes).toBe(budgets.default.maxJsGzipBytes);
});

/** Core Web Vitals observed in the lab. ADVISORY: recorded, never asserted (ADR-021). */
async function labVitals(page: Page): Promise<{ lcp?: number; cls: number }> {
  return page.evaluate(
    () =>
      new Promise<{ lcp?: number; cls: number }>((resolve) => {
        let lcp: number | undefined;
        let cls = 0;
        const done = () => resolve(lcp === undefined ? { cls } : { lcp: Math.round(lcp), cls });
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) lcp = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as unknown as {
              value: number;
              hadRecentInput: boolean;
            }[]) {
              if (!entry.hadRecentInput) cls += entry.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
        } catch {
          resolve({ cls: 0 });
          return;
        }
        // Buffered entries are delivered in the next task; one frame later they have all arrived.
        requestAnimationFrame(() => setTimeout(done, 0));
      }),
  );
}

for (const route of routes) {
  test(`JavaScript for ${route} stays within budget`, async ({ page }, testInfo) => {
    // The budget is a property of the build, not of the viewport: measure once.
    test.skip(testInfo.project.name !== "chromium", "measured on the desktop project only");
    const measurement = await expectWithinJsBudget(page, route);
    const budget = budgetFor(route).maxJsGzipBytes;
    const vitals = await labVitals(page);
    const headroom = Math.round(((budget - measurement.firstPartyGzipBytes) / budget) * 100);
    testInfo.annotations.push({
      type: "advisory",
      description: `${measurement.firstPartyGzipBytes} B of ${budget} B first-party gzip (${headroom}% headroom), ${measurement.thirdPartyGzipBytes} B third-party; lab LCP ${vitals.lcp ?? "n/a"} ms (target 2500), CLS ${vitals.cls.toFixed(3)} (target 0.1)`,
    });
    console.log(
      `JS-MEASURE ${route} first=${measurement.firstPartyGzipBytes} third=${measurement.thirdPartyGzipBytes} budget=${budget} lcp=${vitals.lcp ?? "n/a"} cls=${vitals.cls.toFixed(3)}`,
    );
  });
}
