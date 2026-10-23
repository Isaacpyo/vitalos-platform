import { expect, test } from "@playwright/test";
import { ASKBRIDGE_TEST_ORIGIN, ASKBRIDGE_TEST_SITE_KEY } from "../../playwright.config";
import { askbridgeOn } from "../support/relay";

// Askbridge on the public site (ADR-045). Runs against a build made with E2E_ASKBRIDGE=1, which sets
// ASKBRIDGE_SITE_KEY and a made-up origin. Relay is still switched on in that build, to prove the
// key wins. The Askbridge origin is intercepted: nothing here touches the live service.

test.skip(!askbridgeOn, "needs a build with E2E_ASKBRIDGE=1 (own CI job)");

const SRC = `${ASKBRIDGE_TEST_ORIGIN}/widget/v1/askbridge.js`;

test.describe("Askbridge script", () => {
  test("is added once with the right src and data-site, and Relay does not render", async ({
    page,
  }) => {
    const requested: string[] = [];
    await page.route(`${ASKBRIDGE_TEST_ORIGIN}/**`, (route) => {
      requested.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: "window.__askbridgeStub = (window.__askbridgeStub || 0) + 1;",
      });
    });

    await page.goto("/");
    await page.waitForLoadState("load");
    await expect.poll(() => requested.length, { timeout: 15_000 }).toBeGreaterThan(0);

    const scripts = page.locator('script[src*="askbridge.js"]');
    await expect(scripts).toHaveCount(1);
    await expect(scripts).toHaveAttribute("src", SRC);
    await expect(scripts).toHaveAttribute("data-site", ASKBRIDGE_TEST_SITE_KEY);
    expect(requested).toEqual([SRC]);
    expect(
      await page.evaluate(() => (window as never as { __askbridgeStub: number }).__askbridgeStub),
    ).toBe(1);

    await expect(page.getByRole("button", { name: /Open chat with Relay/ })).toHaveCount(0);
    await expect(page.locator("#relay-panel")).toHaveCount(0);
    await expect(page.locator(".relay-root")).toHaveCount(0);
  });

  test("the CSP lets the page load the script, and keeps frame-ancestors none", async ({
    request,
  }) => {
    const csp = (await request.get("/")).headers()["content-security-policy"] ?? "";
    expect(csp).toContain(`script-src 'self' 'unsafe-inline' ${ASKBRIDGE_TEST_ORIGIN}`);
    expect(csp).toContain(`connect-src 'self' ${ASKBRIDGE_TEST_ORIGIN}`);
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
