import { expect, test } from "@playwright/test";
test("corporate shell is truthful and navigable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("From strategy to production.");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});
