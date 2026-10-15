import { expect, test } from "@playwright/test";
import { FIXTURE_SPECIFIC, isDraftRun } from "../support/content-source";
import type { Page, TestInfo } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";

/**
 * Visitor journeys (Stage 10 §26), clicked through like a person would: no direct URL jumps
 * between steps. Runs on the desktop and 390px projects against the `full` fixture set. What the
 * `sparse` set must NOT offer (gated navigation, closed indexes, links into closed gates) is
 * covered by commercial.sparse, proof.sparse, institutional.sparse and sitemap.sparse.
 *
 * Each journey that submits the enquiry form gets its own client IP (RFC 5737 documentation
 * range, sent as X-Forwarded-For, which the in-memory rate limiter reads outside a trusted proxy),
 * so the suite never competes with other specs for the shared per-IP budget.
 */

// Smooth scrolling keeps Playwright's scroll-into-view from settling (see contact.spec.ts).
test.use({ reducedMotion: "reduce" });

const isCompact = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

function documentationIp(testInfo: TestInfo): string {
  const octet =
    1 + ((testInfo.parallelIndex * 31 + testInfo.retry * 7 + testInfo.workerIndex) % 250);
  const project = testInfo.project.name === "mobile" ? 113 : 100;
  return `203.0.${project}.${octet}`;
}

/** Opens the compact-viewport menu when the navigation is behind it. */
async function openMenuIfCompact(page: Page) {
  if (isCompact(page)) {
    await page.getByRole("banner").getByText("Menu", { exact: true }).click();
  }
}

/** Clicks a header navigation link, through the Menu disclosure on the compact viewport. */
async function clickHeaderLink(page: Page, name: string) {
  await openMenuIfCompact(page);
  const root = page.getByRole("banner");
  // The desktop header also shows the utility links (Trust Centre) next to the navigation.
  await root.getByRole("link", { name, exact: true }).first().click();
}

test.describe("enquiry journey", () => {
  test("home, What We Do, a practice, an offer, then a submitted enquiry that remembers the offer", async ({
    page,
  }, testInfo) => {
    test.skip(isDraftRun, FIXTURE_SPECIFIC);
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": documentationIp(testInfo) });

    await page.goto("/");
    await page.getByRole("link", { name: "Explore what we do" }).click();
    await expect(page).toHaveURL(/\/what-we-do$/);

    await page.locator("main").getByRole("link", { name: "Example Practice (fixture)" }).click();
    await expect(page).toHaveURL(/\/what-we-do\/example-practice$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example Practice (fixture)");

    await page
      .locator("main")
      .getByRole("link", { name: "Example Offer (fixture)" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/offers\/example-offer$/);

    await page.locator("main").getByRole("link", { name: "Talk to Vitalos" }).first().click();
    await expect(page).toHaveURL(/\/contact\?intent=offer&offer=example-offer$/);

    // The offer arrives as a preselected topic and a hidden field, never as visible clutter.
    await expect(page.getByLabel("What would you like to talk about?")).toHaveValue("offer");
    await expect(page.locator('input[name="offerSlug"]')).toHaveValue("example-offer");

    await page.getByLabel("Name").fill("Example Person");
    await page.getByLabel("Work email").fill("example.person@example.invalid");
    await page.getByLabel("Organisation").fill("Example Organisation");
    await page
      .getByLabel("What do you want to achieve?")
      .fill("An artificial journey test enquiry with enough characters to be valid.");
    await page.getByLabel("Timeframe").selectOption("exploring");
    await page.getByRole("checkbox", { name: /privacy notice/ }).check();
    await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Send enquiry" }).click();

    const receipt = page.getByRole("status");
    // Cloudflare's dummy secret is answered locally (no siteverify call), so no network is involved.
    await expect(receipt).toContainText("Your enquiry has been received", { timeout: 20_000 });
    await expect(receipt).toContainText(/VIT-[0-9A-F]{12}/i);
    await expect(page.locator("#enquiry-outcome")).toBeFocused();
    await expectNoA11yViolations(page, {
      exclude: ['iframe[src*="challenges.cloudflare.com"]'],
    });
  });

  test("trust path: Trust Centre, procurement topic, evidence request, contact intent", async ({
    page,
  }) => {
    await page.goto("/");
    await clickHeaderLink(page, "Trust Centre");
    await expect(page).toHaveURL(/\/trust$/);

    await page.locator('main a[href="/trust/procurement"]').first().click();
    await expect(page).toHaveURL(/\/trust\/procurement$/);

    await page.getByRole("link", { name: "Request procurement evidence" }).click();
    await expect(page).toHaveURL(/\/contact\?intent=procurement$/);
    await expect(page.getByLabel("What would you like to talk about?")).toHaveValue("procurement");
    // Controlled evidence is requested through the enquiry, never offered as a public download.
    await expect(page.locator('main a[href$=".pdf"]')).toHaveCount(0);
  });

  test("the header call to action reaches the contact page from any template", async ({ page }) => {
    // The draft source (ADR-025) has no case studies, so its run starts from Labs instead.
    const starts = isDraftRun
      ? ["/what-we-do/engineering", "/labs", "/legal/privacy"]
      : ["/what-we-do/example-practice", "/work", "/legal/privacy"];
    for (const start of starts) {
      await page.goto(start);
      await openMenuIfCompact(page);
      await page.getByRole("banner").getByRole("link", { name: "Talk to Vitalos" }).first().click();
      await expect(page, start).toHaveURL(/\/contact$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    }
  });
});

test.describe("gated sections are reachable while their gates are open", () => {
  // Needs the full set's open Work gate; under draft it stays closed and
  // draft-content.http.spec.ts asserts the 404s.
  test.skip(isDraftRun, FIXTURE_SPECIFIC);

  test("the header leads to Work, Labs and Industries, each with its own heading", async ({
    page,
  }) => {
    for (const [label, path] of [
      ["Work", /\/work$/],
      ["Labs", /\/labs$/],
      ["Industries", /\/industries$/],
    ] as const) {
      await page.goto("/");
      await clickHeaderLink(page, label);
      await expect(page, label).toHaveURL(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    }
  });

  // Insights articles come from the Super Admin (ADR-035): tests/content covers them.
  test("a case study is reachable from its index", async ({ page }) => {
    await page.goto("/work");
    await page.locator('main a[href="/work/example-case-study"]').first().click();
    await expect(page).toHaveURL(/\/work\/example-case-study$/);
  });
});

test.describe("compact navigation", () => {
  test("the Menu disclosure opens, closes and works from the keyboard", async ({ page }) => {
    test.skip(!isCompact(page), "the desktop header shows the navigation directly");
    await page.goto("/");
    const header = page.getByRole("banner");
    const summary = header.locator("summary", { hasText: "Menu" });
    // The first <details> is the Menu itself; the nested ones are its section disclosures.
    const details = header.locator("details").first();
    const nav = header.getByRole("navigation", { name: "Primary" });

    await expect(details).not.toHaveJSProperty("open", true);
    await expect(nav).toBeHidden();

    await summary.click();
    await expect(details).toHaveJSProperty("open", true);
    await expect(nav).toBeVisible();
    // The open panel stays inside the viewport and does not add sideways scroll.
    const box = await nav.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await summary.click();
    await expect(details).not.toHaveJSProperty("open", true);
    await expect(nav).toBeHidden();

    // Keyboard: Enter opens and Space closes the native disclosure.
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(nav).toBeVisible();
    await page.keyboard.press("Space");
    await expect(nav).toBeHidden();
    await expect(summary).toBeFocused();
  });

  test("following a menu link lands on that page with the menu closed", async ({ page }) => {
    test.skip(!isCompact(page), "the desktop header shows the navigation directly");
    await page.goto("/");
    await openMenuIfCompact(page);
    await page
      .getByRole("banner")
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "About", exact: true })
      .click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("banner").locator("details").first()).not.toHaveJSProperty(
      "open",
      true,
    );
  });
});

test.describe("desktop mega-menu", () => {
  const toggleOf = (page: Page) =>
    page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /What We Do/ });

  test("opens and closes from the keyboard and keeps a sensible tab order", async ({ page }) => {
    test.skip(isCompact(page), "the compact viewport uses the Menu disclosure");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    const toggle = toggleOf(page);
    const label = nav.getByRole("link", { name: "What We Do", exact: true });

    // Tab order: the section link first, then its disclosure button.
    await label.focus();
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Enter opens; the panel's links follow the button in tab order.
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    const panel = nav.locator(`#${await toggle.getAttribute("aria-controls")}`);
    await expect(panel.locator(":focus"), "focus moves into the panel").toHaveCount(1);
    await expect(panel.locator(":focus")).toBeVisible();

    // Shift+Tab returns to the button, Escape closes and keeps focus there.
    await page.keyboard.press("Shift+Tab");
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();

    // Space opens too, and tabbing out of the menu closes it again.
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await nav.getByRole("link", { name: "Industries", exact: true }).focus();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("a menu link is reachable by keyboard alone and navigates", async ({ page }) => {
    test.skip(isCompact(page), "the compact viewport uses the Menu disclosure");
    await page.goto("/");
    const toggle = toggleOf(page);
    await toggle.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "How We Work" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/how-we-work$/);
  });

  test("hover opens it for a fine pointer and Escape dismisses it (WCAG 1.4.13)", async ({
    page,
  }) => {
    test.skip(isCompact(page), "the compact viewport uses the Menu disclosure");
    await page.goto("/");
    const toggle = toggleOf(page);
    await toggle.hover();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
