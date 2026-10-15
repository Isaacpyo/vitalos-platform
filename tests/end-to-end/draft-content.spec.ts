import { expect, test } from "@playwright/test";
import { isDraftRun } from "../support/content-source";
import { NOT_FOUND_PATH, TEMPLATES } from "../support/routes";

/**
 * The draft content source (ADR-025). Under E2E_CONTENT_SOURCE=draft (the `e2e-draft` CI job)
 * every page carries the "Draft content, pending approval" ribbon, and the pages that render invented
 * placeholder content (ADR-025 status note, 11 October 2026) also carry the "Placeholder — replace
 * before launch" notice, are noindex and emit no structured data; under any other source neither
 * notice may appear.
 */

const ribbon = (page: import("@playwright/test").Page) =>
  page.getByRole("complementary", { name: "Draft content notice" });

test.describe("draft content ribbon is absent outside the draft source", () => {
  test.skip(isDraftRun, "the draft run asserts the ribbon is present instead");

  for (const path of ["/", "/contact", NOT_FOUND_PATH]) {
    test(`${path}: no draft ribbon`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("[data-draft-ribbon]")).toHaveCount(0);
      await expect(page.getByText("Draft content, pending approval.")).toHaveCount(0);
    });
  }
});

test.describe("draft content source", () => {
  test.skip(!isDraftRun, "runs only against a server built with E2E_CONTENT_SOURCE=draft");

  for (const { name, path } of [...TEMPLATES, { name: "404", path: NOT_FOUND_PATH }]) {
    test(`${name}: shows the draft ribbon above the header`, async ({ page }) => {
      await page.goto(path);
      const notice = ribbon(page);
      await expect(notice).toBeVisible();
      await expect(notice).toContainText("Draft content, pending approval.");
      // In the page flow before the site header, never fixed over content.
      const position = await notice.evaluate((el) => getComputedStyle(el).position);
      expect(position).toBe("static");
      const header = page.locator("header").first();
      if ((await header.count()) > 0) {
        const [ribbonBox, headerBox] = await Promise.all([
          notice.boundingBox(),
          header.boundingBox(),
        ]);
        expect(ribbonBox && headerBox && ribbonBox.y <= headerBox.y).toBe(true);
      }
    });
  }

  test("the ribbon steps aside only while the compact menu sheet is open", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const header = page.getByRole("banner");
    const menu = header.locator("summary", { hasText: "Menu" });
    const sheet = header.locator("details[data-mobile-nav-sheet]");
    const nav = header.getByRole("navigation", { name: "Primary" });
    await expect(ribbon(page)).toBeVisible();

    for (const close of ["Escape", "Menu button"] as const) {
      await menu.click();
      await expect(sheet).toHaveJSProperty("open", true);
      await expect(ribbon(page)).toBeHidden();
      // Expand a section disclosure: it may stay open after the sheet closes.
      await nav.locator("details summary", { hasText: "What We Do" }).first().click();
      await expect(nav.locator("details[open] summary", { hasText: "What We Do" })).toHaveCount(1);
      if (close === "Escape") await page.keyboard.press("Escape");
      else await menu.click();
      await expect(sheet, close).toHaveJSProperty("open", false);
      await expect(ribbon(page), `visible again after closing with ${close}`).toBeVisible();
    }

    // After a client-side navigation from the menu, the ribbon is still shown.
    await menu.click();
    await nav.locator("details summary", { hasText: "Who We Are" }).first().click();
    await nav.getByRole("link", { name: "About", exact: true }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(ribbon(page)).toBeVisible();
  });

  test("home keeps the locked hero and renders the drafted sections", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modernise. Build. Adopt AI.");
    for (const heading of [
      "Problems we solve",
      "From strategy to production",
      "Five practices, one firm",
      "Industries",
      "Vitalos Labs",
      "Have a problem worth solving?",
    ]) {
      await expect(main.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    // The home page stays free of placeholder content (no Selected Work or Insights), and the
    // Trust, Leadership and AI at the centre bands were removed (owner direction, 15 Oct 2026).
    for (const heading of [
      "Selected Work",
      "Insights",
      "Trust",
      "Leadership",
      "AI at the centre",
    ]) {
      await expect(main.getByRole("heading", { name: heading, exact: true })).toHaveCount(0);
    }
  });

  test("navigation shows every section: the placeholder content opens the gates", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation").first();
    for (const open of ["Industries", "Labs", "Work", "Insights"]) {
      await expect(
        nav.getByRole("link", { name: open, exact: true, includeHidden: true }).first(),
      ).toBeAttached();
    }
  });

  for (const path of [
    "/work",
    "/work/connecting-field-and-warehouse-systems",
    "/insights",
    "/insights/why-ai-pilots-stall-before-production",
    "/people/alex-morgan",
    "/careers",
    "/careers/senior-engineer-technical-lead",
  ]) {
    test(`${path}: placeholder notice, noindex and no structured data`, async ({ page }) => {
      await page.goto(path);
      await expect(
        page.getByRole("complementary", { name: "Placeholder content notice" }),
      ).toContainText("Placeholder — replace before launch");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    });
  }

  test("pages without placeholder content carry no placeholder notice", async ({ page }) => {
    for (const path of ["/", "/what-we-do/engineering", "/industries/health-care", "/contact"]) {
      await page.goto(path);
      await expect(page.locator("[data-placeholder-notice]"), path).toHaveCount(0);
    }
  });

  test("the placeholder role applies through the careers contact route", async ({ page }) => {
    await page.goto("/careers/senior-engineer-technical-lead");
    await expect(page.locator('main a[href="/contact?intent=careers"]')).toHaveCount(1);
    await expect(page.locator("main")).not.toContainText(/salary|£/i);
  });

  test("offers carry no prices", async ({ page }) => {
    await page.goto("/offers/ai-opportunity-assessment");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Opportunity Assessment");
    await expect(page.locator("main")).not.toContainText("£");
  });

  test("legal pages are marked not in force and unindexed", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("DRAFT — not in force");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("Labs assets state their maturity and limitations", async ({ page }) => {
    await page.goto("/labs/research/production-ai-evaluation-harness");
    await expect(page.locator("main")).toContainText("Concept");
    await expect(page.locator("main")).toContainText("makes no claim about any implementation");
  });

  test("trust topics with nothing verified to show are not published", async ({ page }) => {
    // Certifications and Subprocessors are not drafted (ADR-025): their pages are 404s and nothing
    // links to them, so no empty or "coming soon" block is ever shown.
    for (const path of ["/trust/certifications", "/trust/subprocessors"]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
    await page.goto("/trust");
    await expect(page.locator('a[href="/trust/certifications"]')).toHaveCount(0);
    await expect(page.locator('a[href="/trust/subprocessors"]')).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/coming soon/i);
  });
});
