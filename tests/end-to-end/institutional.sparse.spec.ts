import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

/**
 * Institutional templates with sparse content (workstream G2b).
 *
 * Runs in the `sparse` Playwright project against a server built with VITALOS_FIXTURE_SET=sparse:
 * no About, Leadership or Trust route pages, one trust topic without certifications or
 * subprocessors, one leadership profile, only a closed role, one legal page. Pages without a CMS
 * document fall back to the locked navigation label as their heading, say nothing else, and are
 * not indexed; nothing links to a page that does not exist.
 * Enable with:  E2E_FIXTURE_SET=sparse E2E_SPARSE_BASE_URL=http://127.0.0.1:3210 \
 *               pnpm exec playwright test --project=sparse
 */

/** Sections owned by other workstreams (G2a) that may not exist on this branch; not link-checked. */
const OWNED_ELSEWHERE = ["/what-we-do", "/solutions", "/offers", "/industries", "/how-we-work"];

async function expectNoDeadLinks(page: Page) {
  const hrefs = await page
    .locator("a[href^='/']")
    .evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href") ?? ""));
  const paths = [...new Set(hrefs.map((href) => href.split("#")[0]!.split("?")[0]!))].filter(
    (path) => path !== "" && !OWNED_ELSEWHERE.some((prefix) => path.startsWith(prefix)),
  );
  for (const path of paths) {
    const response = await page.request.get(path);
    expect(response.status(), `${path} linked from ${page.url()}`).toBeLessThan(400);
  }
}

const pages: { name: string; path: string; h1: string }[] = [
  { name: "about", path: "/about", h1: "About" },
  { name: "leadership", path: "/about/leadership", h1: "Leadership" },
  { name: "trust overview", path: "/trust", h1: "Trust Centre" },
  { name: "trust topic", path: "/trust/security", h1: "Example trust topic: security (fixture)" },
  { name: "legal", path: "/legal/privacy", h1: "Example privacy page (fixture)" },
];

test.describe("sparse content", () => {
  for (const entry of pages) {
    test(`${entry.name}: renders, has one h1, no axe violations, reflows, no dead links`, async ({
      page,
    }) => {
      const response = await page.goto(entry.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(entry.h1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoA11yViolations(page);
      await expectNoHorizontalOverflowAt320(page);
      await expectNoDeadLinks(page);
    });
  }

  test("about and leadership without a route page are not indexed and do not link to Careers", async ({
    page,
  }) => {
    await page.goto("/about");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Careers" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Example Person (fixture)" })).toBeVisible();
  });

  test("a trust topic with nothing but a title omits every empty block", async ({ page }) => {
    await page.goto("/trust/security");
    await expect(page.getByRole("heading", { name: "Certifications" })).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.locator("main").getByRole("heading", { level: 2 })).toHaveCount(0);
  });

  test("the trust overview still offers the controlled evidence request", async ({ page }) => {
    await page.goto("/trust");
    await expect(page.getByRole("link", { name: "Request procurement evidence" })).toHaveAttribute(
      "href",
      "/contact?intent=procurement",
    );
  });

  test("topics and legal pages with no document are 404s", async ({ page }) => {
    expect((await page.goto("/trust/certifications"))?.status()).toBe(404);
    expect((await page.goto("/legal/terms"))?.status()).toBe(404);
    expect((await page.goto("/careers"))?.status()).toBe(404);
  });
});
