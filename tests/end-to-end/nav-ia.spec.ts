import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { FIXTURE_SPECIFIC, isDraftRun } from "../support/content-source";
import { isIaRun } from "../support/nav-variant";

// The `ia` header (ADR-045; owner decision 2). Runs only against a server built with
// NEXT_PUBLIC_NAV_VARIANT=ia (Vercel previews default to it), for example:
//   NEXT_PUBLIC_NAV_VARIANT=ia corepack pnpm test:e2e tests/end-to-end/nav-ia.spec.ts
// The full fixture set opens every gate, so Work and Labs are both items here; the Work-to-Labs
// fallback while Work is closed is covered by the header-model unit tests.
test.skip(!isIaRun, "needs a server built with NEXT_PUBLIC_NAV_VARIANT=ia");
test.skip(isDraftRun, FIXTURE_SPECIFIC);

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024;

test.describe("ia navigation", () => {
  test("desktop bar: What We Do, the sections, About, the utility links and the action", async ({
    page,
  }) => {
    test.skip(!isDesktop(page), "the compact viewport uses the menu sheet");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const [label, href] of [
      ["What We Do", "/what-we-do"],
      ["Industries", "/industries"],
      ["Work", "/work"],
      ["Labs", "/labs"],
      ["About", "/about"],
    ] as const) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "href",
        href,
      );
    }
    for (const gone of ["Who We Are", "Support"]) {
      await expect(nav.getByRole("link", { name: gone, exact: true })).toHaveCount(0);
    }
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Trust Centre", exact: true })).toHaveAttribute(
      "href",
      "/trust",
    );
    await expect(banner.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute(
      "href",
      "/contact",
    );
    await expect(banner.getByRole("link", { name: "Talk to Vitalos" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  test("the What We Do menu works from the keyboard and passes axe while open", async ({
    page,
  }) => {
    test.skip(!isDesktop(page), "the compact viewport uses the menu sheet");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    const toggle = nav.getByRole("button", { name: /What We Do/ });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const heading of ["Practices", "Solutions", "Offers", "Industries", "Labs"]) {
      await expect(nav.getByRole("link", { name: heading, exact: true }).first()).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Vitalos Labs" })).toHaveAttribute("href", "/labs");
    await expect(nav.getByRole("link", { name: "All offers" })).toHaveAttribute("href", "/offers");
    // Tab moves into the panel; Escape closes it and returns focus to its button.
    await page.keyboard.press("Tab");
    await expect(nav.locator(":focus")).toHaveCount(1);
    await expectNoA11yViolations(page);
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("marks the current section", async ({ page }) => {
    test.skip(!isDesktop(page), "the compact viewport uses the menu sheet");
    await page.goto("/industries");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Industries", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("the compact menu sheet has the same items and utility links, and passes axe", async ({
    page,
  }) => {
    test.skip(isDesktop(page), "the desktop header shows the navigation directly");
    await page.goto("/");
    await page.getByRole("banner").locator("summary", { hasText: "Menu" }).click();
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Primary" });
    for (const label of ["Industries", "Work", "Labs", "About", "Trust Centre", "Contact"]) {
      await expect(nav.getByRole("link", { name: label, exact: true }).first()).toBeVisible();
    }
    await nav.locator("summary", { hasText: "What We Do" }).click();
    await expect(nav.getByRole("link", { name: "Vitalos Labs" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
