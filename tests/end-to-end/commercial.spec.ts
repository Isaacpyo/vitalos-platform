import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";
import { FIXTURE_SPECIFIC, isDraftRun } from "../support/content-source";
import { jsonLdNode, jsonLdTypes } from "../support/json-ld";
import {
  COMMERCIAL_ROUTES_DRAFT,
  COMMERCIAL_ROUTES_FULL,
  internalLinks,
} from "./commercial.support";

/**
 * Commercial templates and site shell (workstream G2a), against the `full` fixture set: every
 * publication gate is open, every optional field is populated. The `sparse` counterpart is
 * commercial.sparse.spec.ts. Fixtures are artificial ("(fixture)"); nothing here asserts real copy.
 *
 * Every internal link on these pages is requested, including links into the proof and institutional
 * sections (G2b), which must resolve while their gates are open.
 */

/** Pages of the other template families: each must sit in the shell with exactly one main. */
const FIXTURE_OTHER_ROUTES = [
  "/work",
  "/work/example-case-study",
  "/insights",
  "/people/example-person",
  "/labs",
  "/about",
  "/faq",
  "/trust",
  "/trust/security",
  "/careers",
  "/legal/privacy",
  "/contact",
];

/**
 * Under the draft source (ADR-025) Work, Insights, people and Careers have no documents and their
 * gates are closed, so those routes are not pages; the rest are the same paths.
 */
const OTHER_ROUTES = isDraftRun
  ? FIXTURE_OTHER_ROUTES.filter((route) => !/^\/(work|insights|people|careers)(\/|$)/.test(route))
  : FIXTURE_OTHER_ROUTES;

const COMMERCIAL_ROUTES = isDraftRun ? COMMERCIAL_ROUTES_DRAFT : COMMERCIAL_ROUTES_FULL;

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

test.describe("every commercial route", () => {
  for (const route of COMMERCIAL_ROUTES) {
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
      // A crawl of every link on the page (dozens of requests): allow it more time than one page.
      test.slow();
      await page.goto(route);
      const hrefs = await internalLinks(page);
      expect(hrefs.length).toBeGreaterThan(0);
      const statuses = await Promise.all(
        hrefs.map(async (href) => [href, (await request.get(href)).status()] as const),
      );
      for (const [href, status] of statuses) {
        expect(status, `${route} links to ${href}`).toBeLessThan(400);
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
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    await page.goto("/");
    // 1. Hero: locked copy only.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modernise. Build. Adopt AI.");
    // The category eyebrow was removed (owner decision 2026-10-12).
    await expect(page.getByText("Technology Consulting, Engineering")).toHaveCount(0);
    await expect(
      page
        .locator("main")
        .getByText(
          "We help ambitious organisations modernise operations, build digital products and adopt AI.",
          { exact: true },
        ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore what we do" }).first()).toHaveAttribute(
      "href",
      "/what-we-do",
    );
    const main = page.locator("main");
    // 2. Credibility: a verified proof marker.
    await expect(main.getByText("Example verified marker (fixture)")).toBeVisible();
    // Each later section's authored heading (the Trust and Leadership bands were removed).
    const headings: Record<string, string> = {
      problems: "Problems (fixture)",
      strategyToProduction: "Strategy to production (fixture)",
      practices: "Practices (fixture)",
      selectedWork: "Selected work (fixture)",
      industries: "Industries (fixture)",
      labs: "Labs (fixture)",
      insights: "Insights (fixture)",
      finalConversion: "Final conversion (fixture)",
    };
    for (const [key, heading] of Object.entries(headings)) {
      await expect(
        main.getByRole("heading", { level: 2, name: heading }),
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
    const types = await jsonLdTypes(page);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
  });
});

test.describe("site shell", () => {
  test("desktop header shows the three menus and the CTA, and no Trust Centre", async ({
    page,
  }) => {
    test.skip(!isDesktop(page), "the compact viewport uses the mobile navigation");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const [label, href] of [
      ["What We Do", "/what-we-do"],
      ["Who We Are", "/about"],
      ["Support", "/contact"],
    ] as const) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "href",
        href,
      );
    }
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Trust Centre" })).toHaveCount(0);
    await expect(banner.getByRole("link", { name: "Talk to Vitalos" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  test("Who We Are and Support open their panels", async ({ page }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    test.skip(!isDesktop(page), "the compact viewport uses the mobile navigation");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await nav.getByRole("button", { name: /Who We Are/ }).click();
    for (const label of ["About", "Work", "Insights", "All What We Do", "Industries"]) {
      await expect(nav.getByRole("link", { name: label, exact: true }).first()).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Example Industry (fixture)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await nav.getByRole("button", { name: /Support/ }).click();
    await expect(nav.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute(
      "href",
      "/contact",
    );
    await expect(nav.getByRole("link", { name: "FAQ", exact: true })).toHaveAttribute(
      "href",
      "/faq",
    );
  });

  test("the What We Do mega-menu opens from its own button and closes with Escape", async ({
    page,
  }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    test.skip(!isDesktop(page), "the compact viewport uses the mobile navigation");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    const toggle = nav.getByRole("button", { name: /What We Do/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Practices, Solutions and Labs are headings that link to their index; Labs moved in here.
    for (const heading of ["Practices", "Solutions", "Labs"]) {
      await expect(nav.getByRole("link", { name: heading, exact: true })).toBeVisible();
    }
    await expect(nav.getByText("Explore", { exact: true })).toHaveCount(0);
    // Each column closes with a link to its index; the card carries the AI journey and the action.
    await expect(nav.getByRole("link", { name: "All solutions" })).toHaveAttribute(
      "href",
      "/solutions",
    );
    await expect(nav.getByText("Managed AI", { exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Example Practice (fixture)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("the current section is marked in the navigation", async ({ page }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    test.skip(!isDesktop(page), "the compact viewport uses the mobile navigation");
    await page.goto("/offers/example-offer");
    const current = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "What We Do", exact: true });
    await expect(current).toHaveAttribute("aria-current", "true");
  });

  test("the compact viewport exposes the same menus, the social profiles and the CTA", async ({
    page,
  }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    test.skip(isDesktop(page), "the desktop header shows the navigation directly");
    await page.goto("/");
    await page.getByRole("banner").locator("summary", { hasText: "Menu" }).click();
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Trust Centre" })).toHaveCount(0);
    await expect(
      nav.getByRole("link", { name: "Vitalos on Example profile (fixture)" }),
    ).toBeVisible();
    // Each menu is a disclosure whose first link is the section index.
    await nav.locator("summary", { hasText: "What We Do" }).click();
    await expect(nav.getByRole("link", { name: "What We Do", exact: true })).toHaveAttribute(
      "href",
      "/what-we-do",
    );
    await nav.locator("summary", { hasText: "Who We Are" }).click();
    for (const label of ["About", "How We Work", "Industries"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await nav.locator("summary", { hasText: "Support" }).click();
    await expect(nav.getByRole("link", { name: "FAQ", exact: true })).toBeVisible();
  });

  test("the footer lists the gated sections, company links, social profiles and legal identity", async ({
    page,
  }) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      // Below md the link columns start collapsed to their headings; each one opens on its own.
      await expect(footer.locator("details[open]")).toHaveCount(0);
      for (const heading of await footer.locator("summary").all()) await heading.click();
    }
    for (const label of ["Industries", "Work", "Insights", "Labs", "Careers", "FAQ"]) {
      await expect(footer.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(footer.getByRole("link", { name: "Leadership" })).toHaveCount(0);
    await expect(footer.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(
      footer.getByRole("link", { name: "Vitalos on Example profile (fixture)" }),
    ).toBeVisible();
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
  // Asserts fixture document titles and relations; draft-content.spec.ts covers the draft pages.
  test.skip(isDraftRun, FIXTURE_SPECIFIC);

  test("What We Do shows practices, solutions and offers and links to How We Work", async ({
    page,
  }) => {
    await page.goto("/what-we-do");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What we do (fixture)");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Example Practice (fixture)" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Example Solution (fixture)" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Example Offer (fixture)" })).toBeVisible();
    await expect(main.getByRole("link", { name: "How We Work" })).toHaveAttribute(
      "href",
      "/how-we-work",
    );
  });

  test("a practice page shows its sections, no visible breadcrumb, and a BreadcrumbList", async ({
    page,
  }) => {
    await page.goto("/what-we-do/example-practice");
    const main = page.locator("main");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example Practice (fixture)");
    await expect(main.getByText("Example proposition (fixture)")).toBeVisible();
    for (const heading of ["Problems", "Capabilities", "Related offers", "Industries"]) {
      await expect(main.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
    // No visible trail (owner decisions 12 and 16 Oct 2026); the structured data keeps it.
    await expect(page.locator('nav[aria-label*="readcrumb"]')).toHaveCount(0);
    const names = (
      ((await jsonLdNode(page, "BreadcrumbList"))?.itemListElement ?? []) as { name: string }[]
    ).map((item) => item.name);
    expect(names).toEqual(["Home", "What We Do", "Example Practice (fixture)"]);
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
    const crumbs = (await jsonLdNode(page, "BreadcrumbList")) as {
      itemListElement: { name: string }[];
    };
    expect(crumbs.itemListElement.map((item) => item.name)).toEqual([
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
