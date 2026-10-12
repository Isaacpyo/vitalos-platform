import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";
import { COMMERCIAL_ROUTES_SPARSE, internalLinks } from "./commercial.support";

/**
 * Commercial templates below every publication gate (workstream G2a), against the `sparse`
 * fixture set: Work 1, Insights 2, Labs 0, Industries 0, Careers 0, optional fields left out and
 * site settings empty. Runs in the `sparse` project against a server built with
 * VITALOS_FIXTURE_SET=sparse (E2E_SPARSE_BASE_URL); inert otherwise.
 *
 * Asserts the empty-content policy: gated navigation is hidden, gated indexes answer 404, sections
 * without data are omitted, and no link in the shell or the pages leads to a dead end.
 */

const GATED_PATHS = ["/industries", "/work", "/insights", "/labs", "/careers"];

const linksToGatedSection = (hrefs: string[]) =>
  hrefs.filter((href) =>
    GATED_PATHS.some((prefix) => href === prefix || href.startsWith(`${prefix}/`)),
  );

async function hrefsOf(page: Page, route: string) {
  await page.goto(route);
  return internalLinks(page);
}

test.describe("shell with every gate closed", () => {
  test("the header shows only the ungated sections", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "What We Do", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "About", exact: true })).toBeVisible();
    for (const label of ["Industries", "Work", "Insights", "Labs"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Trust Centre" }),
    ).toBeVisible();
  });

  test("the footer omits gated sections, careers and any legal identity", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    for (const label of ["Industries", "Work", "Insights", "Labs", "Careers"]) {
      await expect(footer.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
    // Site settings are empty: no invented company name, number, address or email.
    await expect(footer.getByText(/company number/i)).toHaveCount(0);
    await expect(footer.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  test("the gated Industries index answers 404", async ({ page }) => {
    const response = await page.goto("/industries");
    expect(response?.status()).toBe(404);
  });
});

test.describe("every commercial route in the sparse set", () => {
  for (const route of COMMERCIAL_ROUTES_SPARSE) {
    test(`${route}: renders, has no gated links and no dead internal links`, async ({
      page,
      request,
    }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      const hrefs = await internalLinks(page);
      expect(linksToGatedSection(hrefs), `${route} links to a closed section`).toEqual([]);
      for (const href of hrefs) {
        const linked = await request.get(href);
        expect(linked.status(), `${route} links to ${href}`).toBeLessThan(400);
      }
    });

    test(`${route}: no empty headings, no axe violations, fits 320px`, async ({ page }) => {
      await page.goto(route);
      const empty = await page
        .locator("h1, h2, h3, h4")
        .evaluateAll(
          (headings) =>
            headings.filter((heading) => (heading.textContent ?? "").trim() === "").length,
        );
      expect(empty).toBe(0);
      await expectNoA11yViolations(page);
      await expectNoHorizontalOverflowAt320(page);
    });
  }
});

test.describe("sections without data are omitted", () => {
  test("the homepage keeps the locked hero and drops every section the content cannot support", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modernise. Build. Adopt AI.");
    const main = page.locator("main");
    // The sparse home page has Solutions and Practices only, and no authored headings.
    await expect(main.getByRole("link", { name: "Example Solution (fixture)" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Example Practice (fixture)" })).toBeVisible();
    // No section heading is invented: only the item titles are headings.
    const headings = await main.getByRole("heading", { level: 2 }).allInnerTexts();
    expect(headings.every((text) => /\(fixture\)/.test(text))).toBe(true);
    // Closed or empty sections leave no trace: no work, labs, insights, leadership, trust links.
    for (const prefix of ["/work", "/labs", "/insights", "/industries", "/about/leadership"]) {
      await expect(main.locator(`a[href^="${prefix}"]`)).toHaveCount(0);
    }
    await expect(page.locator("[data-content-gap]")).toHaveCount(0);
  });

  test("a practice with only a proposition shows no empty sections", async ({ page }) => {
    await page.goto("/what-we-do/example-practice");
    const main = page.locator("main");
    await expect(main.getByText("Example proposition (fixture)")).toBeVisible();
    for (const heading of ["Problems", "Capabilities", "Related offers", "Selected work"]) {
      await expect(main.getByRole("heading", { name: heading })).toHaveCount(0);
    }
  });

  test("an offer with only the required fields keeps its engagement summary and no price", async ({
    page,
  }) => {
    await page.goto("/offers/example-offer");
    const main = page.locator("main");
    await expect(main.locator("dl").getByText("Example audience (fixture)")).toBeVisible();
    for (const heading of ["What you receive", "What we need from you"]) {
      await expect(main.getByRole("heading", { name: heading })).toHaveCount(0);
    }
    expect(await main.innerText()).not.toMatch(/[£$€]|\bprice\b|\bpricing\b/i);
  });

  test("How We Work works without a CMS route page", async ({ page }) => {
    await page.goto("/how-we-work");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How We Work");
    await expect(page.getByRole("list", { name: "How We Work" }).getByRole("listitem")).toHaveCount(
      9,
    );
  });

  test("hrefs collected from the shell never point at a gated section", async ({ page }) => {
    const hrefs = await hrefsOf(page, "/what-we-do");
    expect(linksToGatedSection(hrefs)).toEqual([]);
  });
});
