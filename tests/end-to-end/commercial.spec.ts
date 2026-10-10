import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";
import { COMMERCIAL_ROUTES_FULL, internalLinks } from "./commercial.support";

/**
 * Commercial templates and site shell (workstream G2a), against the `full` fixture set: every
 * publication gate is open, every optional field is populated. The `sparse` counterpart is
 * commercial.sparse.spec.ts. Fixtures are artificial ("(fixture)"); nothing here asserts real copy.
 *
 * Every internal link on these pages is requested, including links into the proof and institutional
 * sections (G2b), which must resolve while their gates are open.
 */

/** Pages of the other template families: each must sit in the shell with exactly one main. */
const OTHER_ROUTES = [
  "/work",
  "/work/example-case-study",
  "/insights",
  "/people/example-person",
  "/labs",
  "/about",
  "/about/leadership",
  "/trust",
  "/trust/security",
  "/careers",
  "/legal/privacy",
  "/contact",
];

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

test.describe("every commercial route", () => {
  for (const route of COMMERCIAL_ROUTES_FULL) {
    test(`${route}: one h1, one main, header and footer landmarks`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
    });

    test(`${route}: no axe violations, fits 320px`, async ({ page }) => {
      await page.goto(route);
      await expectNoA11yViolations(page);
      await expectNoHorizontalOverflowAt320(page);
    });

    test(`${route}: internal links resolve`, async ({ page, request }) => {
      await page.goto(route);
      const hrefs = await internalLinks(page);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        const response = await request.get(href);
        expect(response.status(), `${route} links to ${href}`).toBeLessThan(400);
      }
    });
  }
});

test.describe("shell on every other route", () => {
  for (const route of OTHER_ROUTES) {
    test(`${route}: exactly one main, one h1, one header and one footer`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
    });
  }
});

test.describe("homepage", () => {
  test("renders the locked hero and all thirteen sections from the full fixtures", async ({
    page,
  }) => {
    await page.goto("/");
    // 1. Hero: locked copy only.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "We help ambitious organisations modernise operations, build digital products and adopt AI.",
    );
    await expect(
      page.getByText("Technology Consulting, Engineering & Digital Transformation", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("From strategy to production.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore what we do" })).toHaveAttribute(
      "href",
      "/what-we-do",
    );
    const main = page.locator("main");
    // 2. Credibility: a verified proof marker.
    await expect(main.getByText("Example verified marker (fixture)")).toBeVisible();
    // 3 to 13: each section's authored heading.
    for (const key of [
      "problems",
      "strategyToProduction",
      "practices",
      "aiAtTheCentre",
      "selectedWork",
      "industries",
      "trust",
      "labs",
      "insights",
      "leadership",
      "finalConversion",
    ]) {
      await expect(
        main.getByRole("heading", { level: 2, name: `Example ${key} heading (fixture)` }),
        `section ${key}`,
      ).toBeVisible();
    }
  });

  test("shows no unapproved copy, price or sixth practice", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/six connected practices|production-minded partner|lorem ipsum/i);
  });

  test("emits Organization and WebSite structured data from present fields only", async ({
    page,
  }) => {
    await page.goto("/");
    const nodes = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.flatMap((s) => JSON.parse(s.textContent ?? "[]")));
    const types = nodes.map((node: { "@type": string }) => node["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
  });
});

test.describe("site shell", () => {
  test("desktop header shows the gated navigation, the utility link and the CTA", async ({
    page,
  }) => {
    test.skip(!isDesktop(page), "the compact viewport uses the mobile navigation");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const label of ["What We Do", "Industries", "Work", "Insights", "Labs", "About"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Trust Centre" })).toHaveAttribute(
      "href",
      "/trust",
    );
    await expect(banner.getByRole("link", { name: "Talk to Vitalos" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  test("the What We Do mega-menu opens from its own button and closes with Escape", async ({
    page,
  }) => {
    test.skip(!isDesktop(page), "the compact viewport uses the mobile navigation");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    const toggle = nav.getByRole("button", { name: /What We Do/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Practices and Solutions are headings that link to their index; Explore is a plain heading.
    for (const heading of ["Practices", "Solutions"]) {
      await expect(nav.getByRole("link", { name: heading, exact: true })).toBeVisible();
    }
    await expect(nav.getByText("Explore", { exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "How We Work" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Example Practice (fixture)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("the current section is marked in the navigation", async ({ page }) => {
    test.skip(!isDesktop(page), "the compact viewport uses the mobile navigation");
    await page.goto("/offers/example-offer");
    const current = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "What We Do", exact: true });
    await expect(current).toHaveAttribute("aria-current", "true");
  });

  test("the compact viewport exposes the same sections and the CTA through the menu", async ({
    page,
  }) => {
    test.skip(isDesktop(page), "the desktop header shows the navigation directly");
    await page.goto("/");
    await page.getByRole("banner").getByText("Menu", { exact: true }).click();
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Primary" });
    for (const label of ["Industries", "Work", "Insights", "Labs", "About"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Trust Centre" })).toBeVisible();
    // What We Do is a disclosure whose first link is the section index.
    await nav.locator("summary", { hasText: "What We Do" }).click();
    await expect(nav.getByRole("link", { name: "What We Do", exact: true })).toHaveAttribute(
      "href",
      "/what-we-do",
    );
    await expect(nav.getByRole("link", { name: "How We Work" })).toBeVisible();
  });

  test("the footer lists the gated sections, company links and legal identity", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    for (const label of ["Industries", "Work", "Insights", "Labs", "Careers", "Leadership"]) {
      await expect(footer.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(footer.getByText("Example Practice Ltd (fixture)")).toBeVisible();
    await expect(footer.getByText("Company number 00000000 (fixture)")).toBeVisible();
  });

  test("the skip link reaches the single main landmark on a commercial page", async ({ page }) => {
    await page.goto("/what-we-do");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });
});

test.describe("commercial pages", () => {
  test("What We Do shows practices, solutions and offers and links to How We Work", async ({
    page,
  }) => {
    await page.goto("/what-we-do");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Example what-we-do heading (fixture)",
    );
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Example Practice (fixture)" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Example Solution (fixture)" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Example Offer (fixture)" })).toBeVisible();
    await expect(main.getByRole("link", { name: "How We Work" })).toHaveAttribute(
      "href",
      "/how-we-work",
    );
  });

  test("a practice page shows its sections and a breadcrumb trail", async ({ page }) => {
    await page.goto("/what-we-do/example-practice");
    const main = page.locator("main");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example Practice (fixture)");
    await expect(main.getByText("Example proposition (fixture)")).toBeVisible();
    for (const heading of ["Problems", "Capabilities", "Related offers", "Industries"]) {
      await expect(main.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", {
        name: "What We Do",
      }),
    ).toHaveAttribute("href", "/what-we-do");
  });

  test("a solution page shows the problem statement, the journey and its offers", async ({
    page,
  }) => {
    await page.goto("/solutions/example-solution");
    const main = page.locator("main");
    await expect(main.getByText("Example problem statement (fixture)")).toBeVisible();
    await expect(main.getByRole("heading", { level: 2, name: "Typical journey" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Example Offer (fixture)" })).toBeVisible();
    await expect(main.getByText("Example question (fixture)?")).toBeVisible();
  });

  test("an offer page shows its engagement summary as a definition list and no price", async ({
    page,
  }) => {
    await page.goto("/offers/example-offer");
    const main = page.locator("main");
    const summary = main.locator("dl");
    await expect(summary.getByText("Who this is for")).toBeVisible();
    await expect(summary.getByText("Example audience (fixture)")).toBeVisible();
    await expect(summary.getByText("Short engagement")).toBeVisible();
    expect(await main.innerText()).not.toMatch(/[£$€]|\bprice\b|\bpricing\b|\bfrom \d/i);
    // The call to action pre-selects this offer in the enquiry form.
    await expect(main.getByRole("link", { name: "Talk to Vitalos" }).first()).toHaveAttribute(
      "href",
      "/contact?intent=offer&offer=example-offer",
    );
  });

  test("an industry page shows sector realities, problems and related work", async ({ page }) => {
    await page.goto("/industries/example-industry");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 2, name: "Sector realities" })).toBeVisible();
    await expect(main.getByText("Example reality (fixture)")).toBeVisible();
    await expect(main.getByRole("heading", { level: 2, name: "Selected work" })).toBeVisible();
  });

  test("How We Work lists the nine locked stages in order", async ({ page }) => {
    await page.goto("/how-we-work");
    const stages = page.getByRole("list", { name: "How We Work" }).getByRole("heading");
    await expect(stages).toHaveText([
      "Qualify",
      "Discover",
      "Define",
      "Design",
      "Engineer",
      "Validate",
      "Release",
      "Operate",
      "Improve",
    ]);
  });

  test("the index pages list their documents", async ({ page }) => {
    await page.goto("/solutions");
    await expect(page.getByRole("link", { name: "Example Solution Two (fixture)" })).toBeVisible();
    await page.goto("/offers");
    await expect(page.getByRole("link", { name: "Example Offer Two (fixture)" })).toBeVisible();
    await page.goto("/industries");
    await expect(page.getByRole("link", { name: "Example Industry Two (fixture)" })).toBeVisible();
  });

  test("a missing document answers 404", async ({ page }) => {
    for (const path of [
      "/what-we-do/does-not-exist",
      "/solutions/does-not-exist",
      "/offers/does-not-exist",
      "/industries/does-not-exist",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test("a detail page has a canonical URL, a title and a BreadcrumbList", async ({ page }) => {
    await page.goto("/what-we-do/example-practice");
    await expect(page).toHaveTitle(/Example Practice \(fixture\)/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/what-we-do\/example-practice$/,
    );
    const nodes = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.flatMap((s) => JSON.parse(s.textContent ?? "[]")));
    const crumbs = nodes.find((node: { "@type": string }) => node["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual([
      "Home",
      "What We Do",
      "Example Practice (fixture)",
    ]);
  });

  test("the contact page keeps a single main landmark inside the shell", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
  });
});
