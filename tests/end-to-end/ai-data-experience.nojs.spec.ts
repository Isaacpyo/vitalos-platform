import { expect, test } from "@playwright/test";

/**
 * The AI & Data home page and demonstrator without JavaScript (runs in the `no-js` project). The
 * server HTML must carry the essential content: the hero's whole scripted walkthrough, every
 * explorer panel's content (the selected one is shown by CSS), the reconciliation results, and
 * the labels that say it is synthetic and scripted.
 */

test.use({ reducedMotion: "reduce" });

test("hero shows the whole scripted walkthrough at once, labelled, with no dead controls", async ({
  page,
}) => {
  await page.goto("/ai-data");
  const hero = page.locator("#aid-hero-workflow");
  await expect(hero.getByText("Scripted example, not live AI")).toBeVisible();
  await expect(hero.getByText("Synthetic data", { exact: true })).toBeVisible();
  await expect(hero.getByText("The interactive walkthrough needs JavaScript")).toBeVisible();
  await expect(hero.getByRole("heading", { name: /1\. Input/ })).toBeVisible();
  await expect(hero.getByRole("heading", { name: /4\. Review/ })).toBeVisible();
  await expect(hero.getByText("Still needs a person", { exact: true })).toBeVisible();
  await expect(hero.getByRole("button", { name: /^Next:/ })).toBeHidden();
  await expect(hero.getByRole("button", { name: "Open full view" })).toBeHidden();
});

test("the explorer works with radios and CSS alone", async ({ page }) => {
  await page.goto("/ai-data");
  await expect(page.locator("[data-panel=finance-reconciliation]")).toBeVisible();
  await page.getByText("Reading documents in").click();
  await expect(page.locator("[data-panel=document-intake]")).toBeVisible();
  await expect(page.locator("[data-panel=finance-reconciliation]")).toBeHidden();
  await expect(
    page.locator("[data-panel=document-intake]").getByRole("link", { name: /Prepare a brief/ }),
  ).toHaveAttribute("href", "/ai-data/contact?topic=document-intake");
});

test("the reconciliation preview and the demonstrator show their results in the HTML", async ({
  page,
}) => {
  await page.goto("/ai-data");
  const preview = page.locator("section[aria-labelledby=aid-preview]");
  await expect(preview.getByText("INV-40127").first()).toBeVisible();
  await expect(preview.getByText("Amount mismatch").first()).toBeVisible();
  await page.goto("/ai-data/demonstrator");
  const bench = page.locator("section[aria-labelledby=aid-workbench]");
  await expect(bench.getByText("Source: Statement of account")).toBeVisible();
  await expect(bench.getByText("REVIEW_REQUIRED")).toBeVisible();
  await expect(page.getByText("AC-14").first()).toBeVisible();
});
