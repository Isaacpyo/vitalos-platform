import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

/**
 * Institutional templates (workstream G2b): About, Leadership, Trust Centre, Careers, Legal.
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

const templates: { name: string; path: string; ld: string[] }[] = [
  { name: "about", path: "/about", ld: ["BreadcrumbList"] },
  { name: "leadership", path: "/about/leadership", ld: ["BreadcrumbList"] },
  { name: "trust overview", path: "/trust", ld: ["BreadcrumbList"] },
  { name: "trust topic (security)", path: "/trust/security", ld: ["BreadcrumbList"] },
  { name: "trust topic (certifications)", path: "/trust/certifications", ld: ["BreadcrumbList"] },
  { name: "trust topic (subprocessors)", path: "/trust/subprocessors", ld: ["BreadcrumbList"] },
  { name: "trust topic (procurement)", path: "/trust/procurement", ld: ["BreadcrumbList"] },
  { name: "careers", path: "/careers", ld: ["BreadcrumbList"] },
  { name: "open role", path: "/careers/example-role", ld: ["JobPosting", "BreadcrumbList"] },
  { name: "closed role", path: "/careers/example-closed-role", ld: ["BreadcrumbList"] },
  { name: "legal (privacy)", path: "/legal/privacy", ld: ["BreadcrumbList"] },
  { name: "legal (terms)", path: "/legal/terms", ld: ["BreadcrumbList"] },
];

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
      await expectNoA11yViolations(page);
      await expectNoHorizontalOverflowAt320(page);
    });
  }
});

test.describe("about and leadership", () => {
  test("about shows the CMS heading, the leadership profile and onward links", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About (fixture)");
    await expect(
      page.locator("main").getByRole("link", { name: "Example Person (fixture)" }),
    ).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Trust Centre" })).toBeVisible();
    // Careers has open roles in the full set, so it is linked.
    await expect(page.locator("main").getByRole("link", { name: "Careers" })).toBeVisible();
  });

  test("leadership lists leadership profiles only", async ({ page }) => {
    await page.goto("/about/leadership");
    await expect(page.getByRole("link", { name: "Example Person (fixture)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Example Person Two (fixture)" })).toHaveCount(0);
  });
});

test.describe("trust centre", () => {
  test("the overview lists every topic and offers the controlled evidence request", async ({
    page,
  }) => {
    await page.goto("/trust");
    await expect(page.locator('main a[href^="/trust/"]')).toHaveCount(8);
    const request = page.getByRole("link", { name: "Request procurement evidence" });
    await expect(request).toHaveAttribute("href", "/contact?intent=procurement");
  });

  test("certifications show scope and dates; other topics omit the block", async ({ page }) => {
    await page.goto("/trust/certifications");
    await expect(page.getByRole("heading", { level: 2, name: "Certifications" })).toBeVisible();
    await expect(page.getByText("Example scope (fixture)")).toBeVisible();
    await expect(page.locator("main dl time")).not.toHaveCount(0);
    await page.goto("/trust/security");
    await expect(page.getByRole("heading", { name: "Certifications" })).toHaveCount(0);
    await expect(page.locator('[data-kind="certification"]')).toHaveCount(0);
  });

  test("the subprocessor table has a caption, headers and a row", async ({ page }) => {
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
  test("lists the open role only and links to its page", async ({ page }) => {
    await page.goto("/careers");
    await expect(page.locator('main a[href^="/careers/"]')).toHaveCount(1);
    await expect(page.locator('main a[href="/careers/example-role"]')).toBeVisible();
    await expect(page.locator('main a[href="/careers/example-closed-role"]')).toHaveCount(0);
  });

  test("an open role has JobPosting data and an application link", async ({ page }) => {
    await page.goto("/careers/example-role");
    const nodes = await jsonLdNodes(page);
    const job = nodes.find((node) => node["@type"] === "JobPosting");
    expect(job?.["title"]).toBe("Example Role (fixture)");
    expect(job?.["datePosted"]).toBe("2026-02-01");
    expect(job).not.toHaveProperty("baseSalary");
    await expect(page.getByRole("link", { name: "Apply for this role" })).toHaveAttribute(
      "href",
      /^https:\/\//,
    );
  });

  test("a closed role says so, has no JobPosting data and no application link", async ({
    page,
  }) => {
    await page.goto("/careers/example-closed-role");
    await expect(page.getByText("This role is closed")).toBeVisible();
    const types = (await jsonLdNodes(page)).map((node) => node["@type"]);
    expect(types).not.toContain("JobPosting");
    await expect(page.getByRole("link", { name: "Apply for this role" })).toHaveCount(0);
  });

  test("an unknown role is a 404", async ({ page }) => {
    expect((await page.goto("/careers/does-not-exist"))?.status()).toBe(404);
  });
});

test.describe("legal", () => {
  test("shows the CMS title, version, effective date and body", async ({ page }) => {
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
