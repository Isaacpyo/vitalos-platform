import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

/**
 * Contact page and enquiry form (workstream H).
 *
 * The form is gated: it renders ONLY when enquiries can be stored AND a privacy notice is
 * published (`legalPage` "privacy"). Until the fixture content source (workstream C2) is wired
 * into the app and provides a privacy page, the page shows its gated state, so:
 *
 *  - the "gated state" tests below run whenever the form is NOT rendered, and
 *  - the "enquiry form" tests run only when the form IS rendered. They skip themselves with an
 *    explicit reason and activate automatically once fixtures provide a privacy page. No test
 *    changes are needed then.
 *
 * Rate-limited and unavailable messages are covered by component tests
 * (apps/web/src/components/contact/EnquiryForm.test.tsx): triggering them end to end would spend
 * the shared per-IP budget of every other test.
 */

const FORM = "form#enquiry-form";

// The site uses smooth scrolling, which keeps Playwright's scroll-into-view from settling; the
// reduced-motion media query turns it off (globals.css).
test.use({ reducedMotion: "reduce" });
const TURNSTILE_HOST = "challenges.cloudflare.com";
const isTurnstile = (url: string) => new URL(url).hostname === TURNSTILE_HOST;

async function openContact(page: Page, query = ""): Promise<boolean> {
  await page.goto(`/contact${query}`);
  return (await page.locator(FORM).count()) > 0;
}

const SKIP_NO_FORM =
  "The enquiry form is gated off: no published privacy notice yet (fixtures arrive with workstream C2). This test activates when the form renders.";

test.describe("contact page, gated state", () => {
  test("shows one heading and an honest alternative instead of a form", async ({ page }) => {
    const hasForm = await openContact(page);
    test.skip(hasForm, "The enquiry form is rendered, so the gated state is not shown.");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.getByLabel("Work email")).toHaveCount(0);
    await expect(page.getByText("Online enquiries are not available yet")).toBeVisible();
  });

  test("loads no Turnstile script while gated", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    const hasForm = await openContact(page);
    test.skip(hasForm, "The enquiry form is rendered, so the gated state is not shown.");
    expect(requests.some(isTurnstile)).toBe(false);
  });

  test("has no axe violations and fits 320px", async ({ page }) => {
    const hasForm = await openContact(page);
    test.skip(hasForm, "The enquiry form is rendered, so the gated state is not shown.");
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflowAt320(page);
  });
});

test.describe("enquiry form", () => {
  test("labels, types, autocomplete and the consent link", async ({ page }) => {
    test.skip(!(await openContact(page)), SKIP_NO_FORM);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByLabel("Name")).toHaveAttribute("autocomplete", "name");
    const email = page.getByLabel("Work email");
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
    await expect(page.getByLabel("Organisation")).toHaveAttribute("autocomplete", "organization");
    await expect(page.getByLabel(/^Role/)).toHaveAttribute("autocomplete", "organization-title");
    await expect(page.getByLabel("What do you want to achieve?")).toBeVisible();
    await expect(page.getByRole("link", { name: /privacy notice/ })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
    // Consent is never pre-ticked and budget range is not offered.
    await expect(page.getByRole("checkbox", { name: /privacy notice/ })).not.toBeChecked();
    await expect(page.locator('[name="budgetRange"]')).toHaveCount(0);
  });

  test("carries source, notice version and a fresh idempotency key; honeypot is inert", async ({
    page,
  }) => {
    test.skip(!(await openContact(page)), SKIP_NO_FORM);
    await expect(page.locator('input[name="sourcePath"]')).toHaveValue("/contact");
    await expect(page.locator('input[name="privacyNoticeVersion"]')).not.toHaveValue("");
    const key = await page.locator('input[name="idempotencyKey"]').inputValue();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    await page.reload();
    expect(await page.locator('input[name="idempotencyKey"]').inputValue()).not.toBe(key);

    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    await expect(honeypot).toHaveAttribute("autocomplete", "off");
    await expect(page.locator('[aria-hidden="true"]:has(input[name="website"])')).toHaveCount(1);
    const box = await honeypot.boundingBox();
    expect(box === null || box.x < 0).toBe(true);
  });

  test("?intent= preselects the topic; ?offer= and utm_* become hidden fields; bad values are dropped", async ({
    page,
  }) => {
    test.skip(
      !(await openContact(page, "?intent=ai&offer=example-offer&utm_source=newsletter")),
      SKIP_NO_FORM,
    );
    await expect(page.getByLabel("What would you like to talk about?")).toHaveValue("ai");
    await expect(page.locator('input[name="offerSlug"]')).toHaveValue("example-offer");
    await expect(page.locator('input[name="utm_source"]')).toHaveValue("newsletter");

    await openContact(
      page,
      "?intent=not-a-topic&offer=Not%20A%20Slug&utm_medium=" + "x".repeat(150),
    );
    await expect(page.getByLabel("What would you like to talk about?")).toHaveValue("");
    await expect(page.locator('input[name="offerSlug"]')).toHaveCount(0);
    await expect(page.locator('input[name="utm_medium"]')).toHaveCount(0);
  });

  test("validation errors: summary takes focus, inline errors show, values are kept", async ({
    page,
  }) => {
    test.skip(!(await openContact(page)), SKIP_NO_FORM);
    await page.getByLabel("Name").fill("Example Person");
    await page.getByLabel("Work email").fill("not-an-email");
    await page.getByRole("button", { name: "Send enquiry" }).click();

    const summary = page.getByRole("alert", { name: /check the highlighted fields/i });
    await expect(summary).toBeVisible();
    // The sending modal closes on failure and the summary takes focus.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link", { name: /work email address/i })).toBeVisible();
    await expect(summary.getByRole("link", { name: /privacy notice/i })).toBeVisible();

    await expect(page.getByLabel("Name")).toHaveValue("Example Person");
    await expect(page.getByLabel("Work email")).toHaveValue("not-an-email");
    await expect(page.getByLabel("Work email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Organisation")).toHaveAttribute("aria-invalid", "true");
    // Labels persist alongside the errors.
    await expect(page.getByText("Work email", { exact: true })).toBeVisible();

    await summary.getByRole("link", { name: /work email address/i }).click();
    await expect(page.getByLabel("Work email")).toBeFocused();

    await expectNoA11yViolations(page);
  });

  test("submitting opens a sending modal over the page; it closes on a failure and returns focus", async ({
    page,
  }) => {
    test.skip(!(await openContact(page)), SKIP_NO_FORM);
    // Hold the server response so the in-flight state can be observed deterministically.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/contact", async (route) => {
      if (route.request().method() === "POST") await held;
      await route.continue();
    });
    await page.getByLabel("Name").fill("Example Person");
    const send = page.getByRole("button", { name: "Send enquiry" });
    await send.click();
    const dialog = page.getByRole("dialog", { name: /Sending your enquiry/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("status")).toBeVisible();
    // The page behind is inert while the dialog is open, so focus cannot leave it.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    release();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("alert", { name: /check the highlighted fields/i })).toBeFocused();
    await expectNoA11yViolations(page, { exclude: ['iframe[src*="challenges.cloudflare.com"]'] });
  });

  test("happy path shows the reference and a neutral receipt", async ({ page }) => {
    test.skip(!(await openContact(page)), SKIP_NO_FORM);
    await page.getByLabel("Name").fill("Example Person");
    await page.getByLabel("Work email").fill("example.person@example.invalid");
    await page.getByLabel("Organisation").fill("Example Organisation");
    await page.getByLabel("What would you like to talk about?").selectOption("general");
    await page
      .getByLabel("What do you want to achieve?")
      .fill("An artificial end-to-end test enquiry with enough characters to be valid.");
    await page.getByLabel("Timeframe").selectOption("exploring");
    await page.getByRole("checkbox", { name: /privacy notice/ }).check();

    // Cloudflare's documented test key always passes; wait for the widget to hand over a token.
    await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Send enquiry" }).click();

    // An accepted enquiry lands on the thank-you page with its reference (owner direction,
    // 15 Oct 2026). Cloudflare's dummy secret is answered locally (no siteverify call).
    await expect(page).toHaveURL(/\/contact\/thank-you\?ref=VIT-[0-9A-F]{12}$/i, {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your enquiry has been received",
    );
    const receipt = page.getByRole("status");
    await expect(receipt).toContainText(/VIT-[0-9A-F]{12}/i);
    await expect(page.locator(FORM)).toHaveCount(0);
    // No response-time promise.
    const text = (await receipt.innerText()).toLowerCase();
    expect(text).not.toMatch(/within|hours|days|shortly|\bsoon\b/);
    // The server action's redirect is a client navigation: the receipt's <title> streams in just
    // after the URL changes, so wait for it before axe checks the document title.
    await expect(page).toHaveTitle(/Your enquiry has been received/);
    await expectNoA11yViolations(page);
  });

  test("Turnstile is loaded on this page only", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    test.skip(!(await openContact(page)), SKIP_NO_FORM);
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveCount(1, {
      timeout: 30_000,
    });
    expect(requests.some(isTurnstile)).toBe(true);

    // A separate page, so late requests from the contact page cannot be mistaken for the home page's.
    const home = await page.context().newPage();
    const homeRequests: string[] = [];
    home.on("request", (request) => homeRequests.push(request.url()));
    await home.goto("/");
    await home.waitForLoadState("load");
    expect(homeRequests.some(isTurnstile)).toBe(false);
  });

  test("has no axe violations and fits 320px", async ({ page }) => {
    test.skip(!(await openContact(page)), SKIP_NO_FORM);
    await expectNoA11yViolations(page, {
      // The Turnstile iframe is Cloudflare's document and is not ours to fix.
      exclude: ['iframe[src*="challenges.cloudflare.com"]'],
    });
    await expectNoHorizontalOverflowAt320(page);
  });
});
