import { expect, test } from "@playwright/test";

/**
 * A missing document on every dynamic route family must put the 404 content in the server HTML.
 * Runs in the `no-js` project (JavaScript disabled), so what is asserted is what a visitor without
 * scripts, and a crawler, actually receives: status 404, the "Page not found" heading, and the
 * site header and footer.
 */
const missing = [
  "/what-we-do/no-such-practice",
  "/solutions/no-such-solution",
  "/offers/no-such-offer",
  "/industries/no-such-industry",
  "/work/no-such-case-study",
  "/insights/no-such-article",
  "/people/no-such-person",
  "/labs/no-such-type",
  "/labs/open-source/no-such-asset",
  "/careers/no-such-role",
  "/legal/no-such-page",
  "/trust/no-such-topic",
];

for (const path of missing) {
  test(`${path} renders the 404 content without JavaScript`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    expect(response?.headers()["cache-control"]).toMatch(/no-store|private/);
    // The raw server HTML, not the post-hydration DOM.
    const html = (await response?.text()) ?? "";
    expect(html).toContain("Page not found");
    expect(html).toMatch(/<header[\s>]/);
    expect(html).toMatch(/<footer[\s>]/);
    expect(html.match(/<main[\s>]/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/<meta name="robots" content="noindex/);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to the homepage" })).toBeVisible();
  });
}
