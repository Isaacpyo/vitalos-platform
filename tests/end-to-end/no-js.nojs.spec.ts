import { expect, test } from "@playwright/test";

// Runs in the `no-js` project (JavaScript disabled). The shell is server-rendered, so the hero
// heading and primary navigation must be present without any client script.
test("homepage renders its heading and primary navigation without JavaScript", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});
