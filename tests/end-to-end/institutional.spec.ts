import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { FIXTURE_SPECIFIC, isDraftRun } from "../support/content-source";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

/**
 * Institutional templates (workstream G2b): About, FAQ, Trust Centre, Legal. Careers comes from
 * the Super Admin (ADR-035) and is covered by tests/content against a fake admin.
 *
 * Runs against the production build with the `full` fixture set. Below-gate behaviour is covered
 * by institutional.sparse.spec.ts. Runs on the desktop and 390px mobile projects, and every
 * template is also checked at 320px for reflow.
 */

async function jsonLdNodes(page: Page): Promise<Record<string, unknown>[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return scripts.flatMap((text) => {
    const data: unknown = JSON.parse(text);
    return (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
  });
}

const fixtureTemplates: { name: string; path: string; ld: string[] }[] = [
  { name: "about", path: "/about", ld: ["BreadcrumbList"] },
  { name: "faq", path: "/faq", ld: ["BreadcrumbList"] },
  { name: "trust overview", path: "/trust", ld: ["BreadcrumbList"] },
  { name: "trust topic (security)", path: "/trust/security", ld: ["BreadcrumbList"] },
  { name: "trust topic (certifications)", path: "/trust/certifications", ld: ["BreadcrumbList"] },
  { name: "trust topic (subprocessors)", path: "/trust/subprocessors", ld: ["BreadcrumbList"] },
  { name: "trust topic (procurement)", path: "/trust/procurement", ld: ["BreadcrumbList"] },
  { name: "legal (privacy)", path: "/legal/privacy", ld: ["BreadcrumbList"] },
  { name: "legal (terms)", path: "/legal/terms", ld: ["BreadcrumbList"] },
];

/**
 * Under the draft source (ADR-025) the Certifications and Subprocessors topics are not published:
 * no such pages. Careers and the role render invented placeholder content (ADR-025 status note,
 * 11 October 2026), so they emit no structured data at all.
 */
const notDrafted = /^\/(trust\/(certifications|subprocessors)$|careers\/example-)/;
const placeholderPages = /^\/careers$/;
const templates = (
  isDraftRun
    ? fixtureTemplates.filter((template) => !notDrafted.test(template.path))
    : fixtureTemplates
).map((template) =>
  isDraftRun && placeholderPages.test(template.path) ? { ...template, ld: [] } : template,
);

test.describe("every institutional template", () => {
  for (const template of templates) {
    test(`${template.name}: one h1, structured data, no axe violations, reflows at 320px`, async ({
      page,
    }) => {
      const response = await page.goto(template.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);
      const types = (await jsonLdNodes(page)).map((node) => node["@type"]);
      expect(types).toEqual(expect.arrayContaining(template.ld));
      if (isDraftRun && placeholderPages.test(template.path)) expect(types).toEqual([]);
      await expectNoA11yViolations(page);
      await expectNoHorizontalOverflowAt320(page);
    });
  }
});

test.describe("about and the removed leadership page", () => {
  test("about shows the CMS heading and onward links, and no leadership section", async ({
    page,
  }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About (fixture)");
    await expect(page.locator("main #leadership")).toHaveCount(0);
    await expect(page.locator("main").getByRole("link", { name: "Trust Centre" })).toBeVisible();
    // Careers follows the Super Admin's `careers_open` (ADR-035): closed with no content API.
    await expect(page.locator("main").getByRole("link", { name: "Careers" })).toHaveCount(0);
  });

  test("the old leadership address goes to About", async ({ page }) => {
    await page.goto("/about/leadership");
    await expect(page).toHaveURL(/\/about$/);
  });
});

test.describe("faq", () => {
  test("groups each solution's questions under its name, with a link to the solution", async ({
    page,
  }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    await page.goto("/faq");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Frequently asked questions");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await main.getByText("Example question (fixture)?").first().click();
    await expect(main.getByText("Example answer (fixture).").first()).toBeVisible();
    await expect(main.locator('a[href^="/solutions/"]').first()).toBeVisible();
  });
});

test.describe("trust centre", () => {
  test("the overview lists every topic and offers the controlled evidence request", async ({
    page,
  }) => {
    await page.goto("/trust");
    // Every published topic: all eight fixture topics, or the six drafted ones (ADR-025).
    await expect(page.locator('main a[href^="/trust/"]')).toHaveCount(isDraftRun ? 6 : 8);
    const request = page.getByRole("link", { name: "Request procurement evidence" });
    await expect(request).toHaveAttribute("href", "/contact?intent=procurement");
  });

  test("certifications show scope and dates; other topics omit the block", async ({ page }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    await page.goto("/trust/certifications");
    await expect(page.getByRole("heading", { level: 2, name: "Certifications" })).toBeVisible();
    await expect(page.getByText("Example scope (fixture)")).toBeVisible();
    await expect(page.locator("main dl time")).not.toHaveCount(0);
    await page.goto("/trust/security");
    await expect(page.getByRole("heading", { name: "Certifications" })).toHaveCount(0);
    await expect(page.locator('[data-kind="certification"]')).toHaveCount(0);
  });

  test("the subprocessor table has a caption, headers and a row", async ({ page }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    await page.goto("/trust/subprocessors");
    const table = page.getByRole("table", { name: "Subprocessors" });
    await expect(table).toBeVisible();
    await expect(table.getByText("Example Subprocessor (fixture)")).toBeVisible();
  });

  test("the procurement topic links the evidence request to the contact intent", async ({
    page,
  }) => {
    await page.goto("/trust/procurement");
    await expect(page.getByRole("link", { name: "Request procurement evidence" })).toHaveAttribute(
      "href",
      "/contact?intent=procurement",
    );
  });

  test("an unknown topic is a 404", async ({ page }) => {
    expect((await page.goto("/trust/not-a-topic"))?.status()).toBe(404);
  });
});

test.describe("careers", () => {
  // Careers comes from the Super Admin (ADR-035); with no content API configured it is closed.
  test("the careers pages answer the server-rendered 404", async ({ page }) => {
    for (const path of ["/careers", "/careers/example-role", "/careers/does-not-exist"]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
  });
});

test.describe("legal", () => {
  test("shows the CMS title, version, effective date and body", async ({ page }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Example privacy page (fixture)",
    );
    await expect(page.getByText("Version")).toBeVisible();
    await expect(page.getByText("Effective date")).toBeVisible();
    await expect(page.getByText("Artificial placeholder legal text (fixture)")).toBeVisible();
  });

  test("an unknown legal slug is a 404", async ({ page }) => {
    expect((await page.goto("/legal/imprint"))?.status()).toBe(404);
  });
});
