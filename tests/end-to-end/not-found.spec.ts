import { expect, test } from "@playwright/test";

/**
 * The 404 page in a browser: status 404, noindex, and the site header and footer around one
 * "Page not found" main landmark. Covers an unmatched URL (root not-found) and notFound() raised
 * from dynamic routes (the `(site)` not-found). The server-rendered form of the unmatched case is
 * asserted in protocol.http.spec.ts.
 */
const paths = [
  "/this-page-does-not-exist",
  "/a/b/c/d",
  "/what-we-do/no-such-practice",
  "/labs/not-a-lab-type",
  "/legal/no-such-page",
];

for (const path of paths) {
  test(`${path} is a 404 with the site header and footer`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("banner").getByRole("link").first()).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Go to the homepage" })).toBeVisible();
  });
}
