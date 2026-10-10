import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Contact form without JavaScript (runs in the `no-js` project). The form is a plain
 * `<form action>` posting to the Server Action, so validation errors and values come back in a
 * server-rendered page.
 *
 * Like contact.spec.ts, the form tests skip themselves while the form is gated off (no published
 * privacy notice until fixtures arrive with workstream C2) and activate automatically after.
 *
 * Turnstile needs JavaScript (ADR-019), so with Turnstile configured a complete no-JS submission
 * is answered with the honest "could not verify" message rather than accepted.
 */

const FORM = "form#enquiry-form";

// The site uses smooth scrolling, which keeps Playwright's scroll-into-view from settling; the
// reduced-motion media query turns it off (globals.css).
test.use({ reducedMotion: "reduce" });

async function openContact(page: Page): Promise<boolean> {
  await page.goto("/contact");
  return (await page.locator(FORM).count()) > 0;
}

const SKIP_NO_FORM =
  "The enquiry form is gated off: no published privacy notice yet (fixtures arrive with workstream C2). This test activates when the form renders.";

test("contact page renders its heading without JavaScript, gated or not", async ({ page }) => {
  await openContact(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("an empty submission returns server-rendered errors", async ({ page }) => {
  test.skip(!(await openContact(page)), SKIP_NO_FORM);
  await page.getByLabel("Name").fill("Example Person");
  await page.getByRole("button", { name: "Send enquiry" }).click();

  const summary = page.getByRole("alert", { name: /check the highlighted fields/i });
  await expect(summary).toBeVisible();
  await expect(summary.getByRole("link", { name: /work email address/i })).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Example Person");
  await expect(page.getByLabel("Work email")).toHaveAttribute("aria-invalid", "true");
});

test("a complete submission without the security check is not accepted, and keeps the values", async ({
  page,
}) => {
  test.skip(!(await openContact(page)), SKIP_NO_FORM);
  await page.getByLabel("Name").fill("Example Person");
  await page.getByLabel("Work email").fill("example.person@example.invalid");
  await page.getByLabel("Organisation").fill("Example Organisation");
  await page.getByLabel("What would you like to talk about?").selectOption("general");
  await page
    .getByLabel("What do you want to achieve?")
    .fill("An artificial no-JavaScript test enquiry with enough characters to be valid.");
  await page.getByLabel("Timeframe").selectOption("exploring");
  await page.getByRole("checkbox", { name: /privacy notice/ }).check();
  await page.getByRole("button", { name: "Send enquiry" }).click();

  // Turnstile is enabled in the e2e server, and it cannot run without JavaScript.
  await expect(page.getByText("We could not verify this request")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Example Person");
  await expect(page.getByLabel("Organisation")).toHaveValue("Example Organisation");
});
