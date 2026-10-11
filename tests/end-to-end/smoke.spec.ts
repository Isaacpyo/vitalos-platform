import { expect, test } from "@playwright/test";

// Locked copy: Stage 8 §8 (Homepage hero) and Stage 11 §9. The proposition is the H1;
// the brand line is the supporting line, not the heading.
const proposition =
  "We help ambitious organisations modernise operations, build digital products and adopt AI.";

test("corporate shell shows the locked hero hierarchy and navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(proposition);
  await expect(
    page.getByText("Technology Consulting, Engineering & Digital Transformation", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("From strategy to production.", { exact: true })).toBeVisible();
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
