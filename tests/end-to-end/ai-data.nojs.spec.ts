import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Vitalos AI & Data without JavaScript (runs in the `no-js` project; docs/ai-data/PLAN.md, AID-002
 * and AID-004). The mobile menu is a native disclosure and the form a plain `<form action>`
 * posting to the Server Action, so both work without scripts.
 *
 * Turnstile needs JavaScript (ADR-019), so with Turnstile configured in the e2e server a complete
 * no-JS submission is answered with the honest "could not verify" message and keeps the values.
 */

const FORM = "form#ai-data-enquiry-form";

test.use({ reducedMotion: "reduce" });

async function openContact(page: Page, query = ""): Promise<boolean> {
  await page.goto(`/ai-data/contact${query}`);
  return (await page.locator(FORM).count()) > 0;
}

const SKIP_NO_FORM = "The enquiry form is gated off (no published privacy notice in this source).";

test("the mobile menu opens without JavaScript and lists the section pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ai-data");
  const menu = page.locator("details", { has: page.locator("summary", { hasText: "Menu" }) });
  await menu.locator("summary").click();
  const nav = menu.getByRole("navigation", { name: "Vitalos AI & Data" });
  for (const name of ["Solutions", "Our Approach", "Demonstrator", "Discuss your challenge"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
});

test("an empty submission returns server-rendered errors on the AI & Data fields", async ({
  page,
}) => {
  test.skip(!(await openContact(page)), SKIP_NO_FORM);
  await page.getByLabel("Name", { exact: true }).fill("Example Person");
  await page.getByRole("button", { name: "Send your challenge" }).click();

  const summary = page.getByRole("alert", { name: /check the highlighted fields/i });
  await expect(summary).toBeVisible();
  await expect(summary.getByRole("link", { name: /business problem/i })).toBeVisible();
  await expect(summary.getByRole("link", { name: /sector/i })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Example Person");
  await expect(page.getByLabel("Desired outcome")).toHaveAttribute("aria-invalid", "true");
});

test("?offer= pre-selects a known offer and ignores anything else", async ({ page }) => {
  test.skip(!(await openContact(page, "?offer=ai-proof-of-value")), SKIP_NO_FORM);
  await expect(page.getByLabel("Offer of interest")).toHaveValue("ai-proof-of-value");
  await openContact(page, "?offer=free-lunch");
  await expect(page.getByLabel("Offer of interest")).toHaveValue("");
});

test("a complete submission without the security check is not accepted, and keeps the values", async ({
  page,
}) => {
  test.skip(!(await openContact(page)), SKIP_NO_FORM);
  await page.getByLabel("Name", { exact: true }).fill("Example Person");
  await page.getByLabel("Work email").fill("example.person@example.invalid");
  await page.getByLabel("Organisation").fill("Example Practice (fictional)");
  await page.getByLabel("Sector").selectOption("accounting-bookkeeping");
  await page
    .getByLabel("Business problem or workflow")
    .fill("An artificial no-JavaScript test: supplier statements are re-keyed by hand.");
  await page.getByLabel("Desired outcome").fill("Statements reconciled with exceptions listed.");
  await page.getByLabel("Timeframe").selectOption("exploring");
  await page.getByLabel("Indicative budget").selectOption("not-sure");
  await page.getByRole("checkbox", { name: /privacy notice/ }).check();
  await page.getByRole("button", { name: "Send your challenge" }).click();

  await expect(page.getByText("We could not verify this request")).toBeVisible();
  await expect(page.getByLabel("Organisation")).toHaveValue("Example Practice (fictional)");
  await expect(page.getByLabel("Indicative budget")).toHaveValue("not-sure");
});

test("the demonstrator carries its labels and an evaluation section", async ({ page }) => {
  await page.goto("/ai-data/demonstrator");
  for (const label of ["Synthetic data", "Illustrative example", "Not a product"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  // Pending until a real evaluation run writes demonstrator-report.json; then the results table.
  await expect(
    page
      .getByText("Evaluation results are published after the next evaluation run.")
      .or(page.getByRole("region", { name: "Results by configuration" })),
  ).toBeVisible();
});
