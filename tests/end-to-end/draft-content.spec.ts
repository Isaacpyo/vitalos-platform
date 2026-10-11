import { expect, test } from "@playwright/test";
import { isDraftRun } from "../support/content-source";
import { NOT_FOUND_PATH, TEMPLATES } from "../support/routes";

/**
 * The draft content source (ADR-025). Under E2E_CONTENT_SOURCE=draft (the `e2e-draft` CI job)
 * every page carries the "Draft content, pending approval" ribbon and the closed sections stay
 * closed; under any other source the ribbon must never appear.
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
    await nav.getByRole("link", { name: "About", exact: true }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(ribbon(page)).toBeVisible();
  });

  test("home keeps the locked hero and renders the drafted sections", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "We help ambitious organisations modernise operations, build digital products and adopt AI.",
    );
    for (const heading of [
      "Problems we solve",
      "From strategy to production",
      "Five practices, one firm",
      "AI at the centre",
      "Industries",
      "Trust",
      "Vitalos Labs",
      "Bring us the problem.",
    ]) {
      await expect(main.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    // Empty proof stays empty: no Selected Work, Insights or Leadership sections.
    for (const heading of ["Selected Work", "Insights", "Leadership"]) {
      await expect(main.getByRole("heading", { name: heading, exact: true })).toHaveCount(0);
    }
  });

  test("navigation hides the sections whose gates stay closed", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "Industries", exact: true }).first()).toBeAttached();
    await expect(nav.getByRole("link", { name: "Labs", exact: true }).first()).toBeAttached();
    for (const closed of ["Work", "Insights"]) {
      await expect(nav.getByRole("link", { name: closed, exact: true })).toHaveCount(0);
    }
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
