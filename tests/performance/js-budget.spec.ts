import { test } from "@playwright/test";
import { expectWithinJsBudget, loadBudgets } from "../support/budgets";

// Client JavaScript budgets (ADR-021). F2 adds one entry per template to budgets.json; every
// route with an explicit budget is measured here, so the list never drifts from the file.
const routes = Object.keys(loadBudgets().routes);

for (const route of routes) {
  test(`JavaScript for ${route} stays within budget`, async ({ page }, testInfo) => {
    // The budget is a property of the build, not of the viewport: measure once.
    test.skip(testInfo.project.name !== "chromium", "measured on the desktop project only");
    await expectWithinJsBudget(page, route);
  });
}
