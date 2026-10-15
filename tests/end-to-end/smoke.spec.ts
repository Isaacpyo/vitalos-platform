import { expect, test } from "@playwright/test";

// Locked copy (owner decisions 2026-10-12 and 2026-10-15): the proposition is the H1 and the long
// proposition sentence is the supporting line, not the heading. The hero has no eyebrow.
const proposition = "Modernise. Build. Adopt AI.";
const propositionLong =
  "We help ambitious organisations modernise operations, build digital products and adopt AI.";

test("corporate shell shows the locked hero hierarchy and navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(proposition);
  await expect(
    page.getByText("Technology Consulting, Engineering & Digital Transformation", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("main").getByText(propositionLong, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Talk to Vitalos" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore what we do" })).toBeVisible();
  // The compact viewport keeps the navigation behind the Menu disclosure (MobileNav).
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole("banner").getByText("Menu", { exact: true }).click();
  }
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});

test("homepage shows no unapproved copy or a sixth practice", async ({ page }) => {
  await page.goto("/");
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/six connected practices|production-minded partner|lorem ipsum/i);
});
