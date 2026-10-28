import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

/**
 * The guided, AI-assisted brief on /ai-data/contact (W6). The AI path talks to a local fake of the
 * Super Admin's brief-assist endpoint (tests/support/fake-brief-assist.mjs, started by the
 * Playwright config); the checklist path needs nothing. Synthetic text only.
 *
 * Every shared brief goes through the real enquiry Server Action with the memory backend and
 * Cloudflare's always-passing Turnstile test key, exactly like the contact specs.
 */

const FAKE = `http://127.0.0.1:${process.env.E2E_BRIEF_ASSIST_PORT ?? 3299}`;
const FORM = "form#ai-data-enquiry-form";
const DESCRIPTION =
  "An artificial end-to-end test: supplier statements are matched against the ledger by hand.";
const TURNSTILE = { exclude: ['iframe[src*="challenges.cloudflare.com"]'] } as const;
const DESCRIBE_LABEL = /Describe the workflow you want to improve/;

test.use({ reducedMotion: "reduce" });
// The fake's call counters are shared, so the specs of one project run one after another.
test.describe.configure({ mode: "serial" });

const calls = async (page: Page) =>
  (await (await page.request.get(`${FAKE}/calls`)).json()) as {
    questions: number;
    brief: number;
    rejected: number;
  };

async function open(page: Page, query = ""): Promise<boolean> {
  await page.request.post(`${FAKE}/calls/reset`);
  await page.goto(`/ai-data/contact${query}`);
  // The form is gated off when the content source has no published privacy notice.
  if ((await page.locator("form, [data-guided-brief]").count()) === 0) {
    await page.waitForTimeout(500);
  }
  return (await page.getByLabel(DESCRIBE_LABEL).count()) > 0;
}

const SKIP = "The enquiry form is gated off (no published privacy notice in this source).";

const describe = (page: Page, text = DESCRIPTION) => page.getByLabel(DESCRIBE_LABEL).fill(text);

async function fillShare(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Example Person");
  await page.getByLabel("Work email").fill("example.person@example.invalid");
  await page.getByLabel("Organisation").fill("Example Practice (fictional)");
  await page.getByLabel("Sector").selectOption("accounting-bookkeeping");
  await page.getByLabel("Timeframe").selectOption("exploring");
  await page.getByRole("checkbox", { name: /privacy notice/ }).check();
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
    timeout: 30_000,
  });
}

test("describe step: topic prefill, example chips, the opt-in is off and explained", async ({
  page,
}) => {
  test.skip(!(await open(page, "?topic=document-intake")), SKIP);
  const input = page.getByLabel(DESCRIBE_LABEL);
  await expect(input).toHaveValue(/Documents arrive by email/);
  await input.fill("");
  await page.getByRole("button", { name: "Reconciling statements" }).click();
  await expect(input).toHaveValue(/supplier statements/);
  await expect(page.getByRole("button", { name: "Reconciling statements" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const optIn = page.getByRole("checkbox", { name: /Use AI to suggest questions/ });
  await expect(optIn).not.toBeChecked();
  await page.getByText("What happens to my text if I turn this on?").click();
  await expect(page.getByText(/on to our AI model provider/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Prefer a simple form?" })).toBeVisible();
  await expectNoA11yViolations(page, TURNSTILE);
  await expectNoHorizontalOverflowAt320(page);
});

test("an unknown ?topic= is ignored", async ({ page }) => {
  test.skip(!(await open(page, "?topic=free-lunch")), SKIP);
  await expect(page.getByLabel(DESCRIBE_LABEL)).toHaveValue("");
});

test("the description must be long enough before anything happens", async ({ page }) => {
  test.skip(!(await open(page)), SKIP);
  await describe(page, "Too short");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#aidb-description-error")).toContainText(/at least 20 characters/);
  await expect(page.getByLabel(DESCRIBE_LABEL)).toHaveAttribute("aria-invalid", "true");
});

test("checklist path: no AI, nothing sent, honest labels, edit and remove, share, receipt", async ({
  page,
}) => {
  test.skip(!(await open(page, "?offer=ai-opportunity-assessment")), SKIP);
  await describe(page);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "A few questions" })).toBeFocused();
  await expect(page.getByText("Questions from our checklist: no AI used")).toBeVisible();
  await expect(page.getByTestId("brief-announcer")).toHaveText(/Step 2 of 4/);
  const outcome = page.getByRole("group", { name: /What would a good result look like/ });
  await outcome.getByRole("button", { name: "Fewer errors" }).click();
  await expect(outcome.getByRole("button", { name: "Fewer errors" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(outcome.getByLabel(/Your answer/)).toHaveValue("Fewer errors");
  await expectNoA11yViolations(page, TURNSTILE);

  await page.getByRole("button", { name: "Prepare my brief" }).click();
  await expect(page.getByRole("heading", { name: "Review your brief" })).toBeFocused();
  await expect(page.getByText("Prepared from our checklist: no AI used")).toBeVisible();
  expect(await calls(page)).toEqual({ questions: 0, brief: 0, rejected: 0 });

  await expect(
    page.locator('[data-card="currentWorkflow"]').getByText("You said", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-card="possibleAutomation"]').getByText("Suggested from our checklist"),
  ).toBeVisible();
  const next = page.locator('[data-card="nextStep"]');
  await expect(next).toContainText("AI Opportunity Assessment");
  await expect(next).not.toContainText(/£|\bdays\b|\bweeks\b/);

  // Edit, with inline save feedback and a changed provenance label.
  await next.getByRole("button", { name: "Edit" }).click();
  await next.getByLabel(/Edit suggested next step/).fill("Let us talk it through first.");
  await next.getByRole("button", { name: "Save changes" }).click();
  await expect(next.getByText("Saved. Your edit is part of the brief.")).toBeVisible();
  await expect(next.getByText("Edited by you")).toBeVisible();
  await expect(next.getByRole("button", { name: "Edit" })).toBeFocused();

  // Remove and restore.
  await page.locator('[data-card="unknowns"]').getByRole("button", { name: "Remove" }).click();
  await expect(
    page.getByText("Removed. This card will not be shared with your brief."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore this card" }).click();
  await expect(page.locator('[data-card="unknowns"]')).toBeVisible();
  await expectNoA11yViolations(page, TURNSTILE);

  await page.getByRole("button", { name: "Share this brief" }).click();
  await expect(page.getByRole("heading", { name: "Share your brief" })).toBeFocused();
  // Contact details are asked for only now, and the offer interest is carried over.
  await expect(page.getByLabel("Offer of interest")).toHaveValue("ai-opportunity-assessment");
  await fillShare(page);
  await expectNoA11yViolations(page, TURNSTILE);
  await page.getByRole("button", { name: "Share my brief" }).click();

  await expect(page).toHaveURL(/\/ai-data\/contact\/thank-you\?ref=VIT-[0-9A-F]{12}$/i, {
    timeout: 20_000,
  });
  const shared = page.locator("[data-shared-brief]");
  await expect(shared).toContainText("Let us talk it through first.");
  await expect(shared).toContainText("Prepared from our checklist: no AI used");
  await expect(shared).toContainText("[vitalos-brief v1 questions=checklist brief=checklist]");
  await expect(shared.getByRole("button", { name: "Copy the brief" })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("AI path: the opt-in sends text, and everything the AI wrote is labelled a suggestion", async ({
  page,
}) => {
  test.skip(!(await open(page)), SKIP);
  await describe(page);
  await page.getByRole("checkbox", { name: /Use AI to suggest questions/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Questions suggested by AI")).toBeVisible();
  await expect(page.getByText("Which supplier statements are the hardest to match?")).toBeVisible();
  expect(await calls(page)).toMatchObject({ questions: 1, brief: 0, rejected: 0 });
  await page
    .getByRole("group", { name: /Quick answers for question 1/ })
    .getByRole("button", { name: "Foreign currency" })
    .click();
  await page.getByRole("button", { name: "Prepare my brief" }).click();

  await expect(page.getByText("Drafted by AI", { exact: true })).toBeVisible();
  expect(await calls(page)).toMatchObject({ questions: 1, brief: 1, rejected: 0 });
  await expect(
    page.locator('[data-card="currentWorkflow"]').getByText("Suggested by AI"),
  ).toBeVisible();
  await expect(page.getByText("You said", { exact: true })).toHaveCount(0);
  await expectNoA11yViolations(page, TURNSTILE);
});

for (const [marker, label] of [
  ["[e2e-503]", "unavailable"],
  ["[e2e-429]", "rate limited"],
  ["[e2e-invalid]", "invalid"],
] as const) {
  test(`AI ${label}: falls back to the checklist and says so`, async ({ page }) => {
    test.skip(!(await open(page)), SKIP);
    await describe(page, `${DESCRIPTION} ${marker}`);
    await page.getByRole("checkbox", { name: /Use AI to suggest questions/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("AI was not used")).toBeVisible();
    await expect(page.getByText(/We used our checklist instead/)).toBeVisible();
    await expect(page.getByText("Questions from our checklist: no AI used")).toBeVisible();
    await expect(page.getByText("Questions suggested by AI")).toHaveCount(0);
    await expect(page.getByTestId("brief-announcer")).toHaveText(/AI assistant was not available/);
  });
}

test("the draft survives a reload in this tab, and Start over clears it", async ({ page }) => {
  test.skip(!(await open(page)), SKIP);
  await describe(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "A few questions" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "A few questions" })).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("heading", { name: "Describe the workflow" })).toBeFocused();
  await expect(page.getByLabel(DESCRIBE_LABEL)).toHaveValue("");
  expect(await page.evaluate(() => sessionStorage.getItem("vitalos.aid.brief.v1"))).toBeNull();
});

test("sharing is disabled while pending, so a double click cannot send twice", async ({ page }) => {
  test.skip(!(await open(page)), SKIP);
  await describe(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Prepare my brief" }).click();
  await page.getByRole("button", { name: "Share this brief" }).click();
  await fillShare(page);

  let posts = 0;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/ai-data/contact", async (route) => {
    if (route.request().method() === "POST") {
      posts += 1;
      await held;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Share my brief" }).click();
  await expect(page.getByRole("button", { name: /Sending your brief/ })).toBeDisabled();
  release();
  await expect(page).toHaveURL(/thank-you\?ref=VIT-/i, { timeout: 20_000 });
  expect(posts).toBe(1);
});

test("a simple form is one click away and works on its own", async ({ page }) => {
  test.skip(!(await open(page, "?topic=document-intake")), SKIP);
  await page.getByRole("link", { name: "Prefer a simple form?" }).click();
  await expect(page).toHaveURL(/mode=simple/);
  await expect(page.locator(FORM)).toBeVisible();
  await expect(page.getByLabel(DESCRIBE_LABEL)).toHaveCount(0);
  await expectNoA11yViolations(page, TURNSTILE);
  await page.getByRole("link", { name: "Guided brief" }).click();
  await expect(page.getByLabel(DESCRIBE_LABEL)).toBeVisible();
});
