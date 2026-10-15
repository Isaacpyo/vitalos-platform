import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { FIXTURE_SPECIFIC, isDraftRun } from "../support/content-source";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

/**
 * Proof and authority templates (workstream G2b): Work, People, Labs (Insights: tests/content).
 *
 * Runs against the production build with the `full` fixture set (every publication gate open,
 * every field populated; see packages/cms/src/fixtures/full.ts). Below-gate behaviour is covered by
 * proof.sparse.spec.ts. Fixture content is obviously artificial, "(fixture)" in every string.
 *
 * The suite runs on the desktop and the 390px mobile project, so axe is scanned at both widths;
 * every template is also checked at 320px for reflow.
 */

// Every test here reads fixture case studies, insights, people or Labs assets. Under the draft
// source (ADR-025) there are none of the first three and the Labs assets differ;
// draft-content.spec.ts and the accessibility sweep cover the draft Labs pages.
test.skip(isDraftRun, FIXTURE_SPECIFIC);

const CASE_STUDY_NAMED = "/work/example-case-study";
const CASE_STUDY_ANON = "/work/example-case-study-two";
const CASE_STUDY_PENDING = "/work/example-case-study-pending";
const PERSON = "/people/example-person";
const PERSON_BARE = "/people/example-person-two";
const LAB_CONCEPT = "/labs/reference-architectures/example-reference-architecture";
const LAB_MAINTAINED = "/labs/open-source/example-open-source-tool";

async function jsonLdTypes(page: Page): Promise<string[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return scripts.flatMap((text) => {
    const data: unknown = JSON.parse(text);
    return (Array.isArray(data) ? data : [data]).map(
      (node) => (node as { "@type": string })["@type"],
    );
  });
}

async function jsonLd(page: Page, type: string): Promise<Record<string, unknown>> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const nodes = scripts.flatMap((text) => {
    const data: unknown = JSON.parse(text);
    return (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
  });
  const node = nodes.find((candidate) => candidate["@type"] === type);
  expect(node, `JSON-LD ${type}`).toBeDefined();
  return node!;
}

const templates: { name: string; path: string; ld: string[] }[] = [
  { name: "work index", path: "/work", ld: ["BreadcrumbList"] },
  { name: "case study (named)", path: CASE_STUDY_NAMED, ld: ["BreadcrumbList"] },
  { name: "case study (anonymised)", path: CASE_STUDY_ANON, ld: ["BreadcrumbList"] },
  { name: "person (full)", path: PERSON, ld: ["ProfilePage", "BreadcrumbList"] },
  {
    name: "person (no portrait, no bio)",
    path: PERSON_BARE,
    ld: ["ProfilePage", "BreadcrumbList"],
  },
  { name: "labs index", path: "/labs", ld: ["BreadcrumbList"] },
  { name: "labs category", path: "/labs/open-source", ld: ["BreadcrumbList"] },
  { name: "lab asset (concept)", path: LAB_CONCEPT, ld: ["BreadcrumbList"] },
  { name: "lab asset (maintained)", path: LAB_MAINTAINED, ld: ["BreadcrumbList"] },
];

test.describe("every proof template", () => {
  for (const template of templates) {
    test(`${template.name}: one h1, structured data, no axe violations, reflows at 320px`, async ({
      page,
    }) => {
      const response = await page.goto(template.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);
      expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(template.ld));
      await expectNoA11yViolations(page);
      await expectNoHorizontalOverflowAt320(page);
    });
  }
});

test.describe("work", () => {
  test("lists verified case studies as crawlable rows and omits pending proof", async ({
    page,
  }) => {
    await page.goto("/work");
    const links = page.locator('main a[href^="/work/"]');
    await expect(links).toHaveCount(2);
    expect(await links.evaluateAll((a) => a.map((el) => el.getAttribute("href")))).toEqual(
      expect.arrayContaining([CASE_STUDY_NAMED, CASE_STUDY_ANON]),
    );
    await expect(page.locator(`a[href="${CASE_STUDY_PENDING}"]`)).toHaveCount(0);
  });

  test("filters client-side without changing the URL or adding query pages", async ({ page }) => {
    await page.goto("/work");
    const url = page.url();
    const solution = page.locator("main").getByLabel("Solution");
    await expect(solution).toBeVisible();
    await solution.selectOption({ index: 1 });
    await expect(page.locator("main li[hidden]")).toHaveCount(1);
    await expect(page.locator("main").getByRole("status")).toContainText("Showing 1 of 2");
    expect(page.url()).toBe(url);
    await solution.selectOption("");
    await expect(page.locator("main li[hidden]")).toHaveCount(0);
    // Every row still links to a canonical page with no query string.
    const hrefs = await page
      .locator('main a[href^="/work/"]')
      .evaluateAll((a) => a.map((el) => el.getAttribute("href")));
    expect(hrefs.every((href) => !href?.includes("?"))).toBe(true);
  });

  test("a named client shows its name, sourced metrics and the attributed testimonial", async ({
    page,
  }) => {
    await page.goto(CASE_STUDY_NAMED);
    await expect(page.getByText("Example Client (fixture)", { exact: true })).toBeVisible();
    await expect(page.getByText("Contracted by Vitalos")).toBeVisible();
    await expect(page.getByText("Fixture data, not a real measurement (fixture)")).toBeVisible();
    await expect(page.getByText("An artificial quote (fixture)")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Challenge" })).toBeVisible();
  });

  test("an anonymised client is never named and shows no attributed quote", async ({ page }) => {
    await page.goto(CASE_STUDY_ANON);
    await expect(page.getByText("Anonymised", { exact: true })).toBeVisible();
    await expect(page.getByText("Prior founder / team experience")).toBeVisible();
    await expect(page.getByText("Example Client")).toHaveCount(0);
    await expect(page.locator("blockquote")).toHaveCount(0);
  });

  test("a case study without verified evidence does not exist", async ({ page }) => {
    const response = await page.goto(CASE_STUDY_PENDING);
    expect(response?.status()).toBe(404);
  });

  test("an unknown case study is a 404", async ({ page }) => {
    expect((await page.goto("/work/does-not-exist"))?.status()).toBe(404);
  });
});

// Insights pages come from the Super Admin (ADR-035) and are covered by tests/content; with no
// content API configured they answer the server-rendered 404 (not-found.nojs.spec.ts).

test.describe("people", () => {
  test("a profile works without a portrait: monogram, role, bio and verified link", async ({
    page,
  }) => {
    await page.goto(PERSON);
    await expect(page.locator('[data-kind="person-hero"] img')).toHaveCount(0);
    await expect(page.getByText("Example role (fixture)")).toBeVisible();
    await expect(page.getByText("Artificial biography paragraph")).toBeVisible();
    await expect(
      page.locator("main").getByRole("link", { name: "example.invalid" }),
    ).toHaveAttribute("href", /^https:\/\/example\.invalid\//);
    const profile = await jsonLd(page, "ProfilePage");
    expect(JSON.stringify(profile)).toContain("Example Person");
  });

  test("a bare profile shows no empty sections and no unverified links", async ({ page }) => {
    await page.goto(PERSON_BARE);
    await expect(page.locator("main").getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.locator('main a[href^="https://"]')).toHaveCount(0);
  });

  test("an unknown person is a 404", async ({ page }) => {
    expect((await page.goto("/people/does-not-exist"))?.status()).toBe(404);
  });
});

test.describe("labs", () => {
  test("the index lists categories, maturity and filters by maturity client-side", async ({
    page,
  }) => {
    await page.goto("/labs");
    await expect(page.getByRole("link", { name: "Open Source", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Reference Architectures", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-maturity]")).toHaveCount(2);
    const url = page.url();
    await page.getByLabel("Maturity").selectOption("prototype");
    await expect(page.locator("main li[hidden]")).toHaveCount(1);
    await expect(page.locator("main").getByRole("status")).toContainText("Showing 1 of 2");
    expect(page.url()).toBe(url);
  });

  test("an asset states maturity above the fold and always shows its limitations", async ({
    page,
  }) => {
    await page.goto(LAB_CONCEPT);
    const badge = page.locator("[data-maturity]").first();
    await expect(badge).toHaveText("Concept");
    const viewport = page.viewportSize()!;
    const box = (await badge.boundingBox())!;
    expect(box.y + box.height).toBeLessThan(viewport.height);
    const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(box.y).toBeGreaterThan(h1.y);
    await expect(page.getByRole("heading", { level: 2, name: "Known limitations" })).toBeVisible();
    await expect(page.getByText("Fixture only; no real implementation (fixture)")).toBeVisible();
    // What it is / is not, and no resources for an asset without maintained links.
    await expect(page.getByText("What it is", { exact: true })).toBeVisible();
    await expect(page.getByText("What it is not", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resources" })).toHaveCount(0);
  });

  test("an asset with maintained links shows the repository and demo links", async ({ page }) => {
    await page.goto(LAB_MAINTAINED);
    await expect(page.getByText("Prototype", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Resources" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Repository" })).toHaveAttribute(
      "href",
      /^https:\/\//,
    );
    await expect(page.getByRole("link", { name: "Demo" })).toBeVisible();
  });

  test("an unknown type, an empty type and a wrong-type asset are 404s", async ({ page }) => {
    expect((await page.goto("/labs/not-a-type"))?.status()).toBe(404);
    // A real type with no published assets has no page.
    expect((await page.goto("/labs/research"))?.status()).toBe(404);
    // Lab slugs are unique only within a type.
    expect((await page.goto("/labs/research/example-open-source-tool"))?.status()).toBe(404);
  });
});
