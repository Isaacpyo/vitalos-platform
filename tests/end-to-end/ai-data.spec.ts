import { expect, test } from "@playwright/test";

/**
 * Vitalos AI & Data marketing experience (W5, ADR-054): the hero walkthrough, the workflow
 * explorer, the demonstrator and the lazily loaded overlays. Scripted examples on synthetic data:
 * nothing here depends on a model or a timer.
 */

test.describe("home", () => {
  test("hero: stages advance only when asked, and say it is scripted, synthetic and not live AI", async ({
    page,
  }) => {
    await page.goto("/ai-data");
    const hero = page.locator("#aid-hero-workflow");
    await expect(hero.getByText("Scripted example, not live AI")).toBeVisible();
    await expect(hero.getByText("Synthetic data", { exact: true })).toBeVisible();
    await expect(hero.getByRole("heading", { name: "Step 1 of 4: Input" })).toBeVisible();
    // Nothing moves on its own.
    await page.waitForTimeout(1500);
    await expect(hero.getByRole("heading", { name: "Step 1 of 4: Input" })).toBeVisible();
    await hero.getByRole("button", { name: /^Next: Read/ }).click();
    await expect(hero.getByRole("heading", { name: "Step 2 of 4: Read" })).toBeVisible();
    await expect(hero.getByRole("button", { name: /^Read$|Read/ }).first()).toBeVisible();
    await hero.getByRole("button", { name: /^Next: Check/ }).click();
    const flagged = hero.getByRole("button", { name: /INV-3102/ });
    await flagged.click();
    await expect(flagged).toHaveAttribute("aria-expanded", "true");
    await expect(
      hero.getByRole("region", { name: "Cited source lines" }).filter({ visible: true }),
    ).toHaveCount(1);
    await hero.getByRole("button", { name: /^Next: Review/ }).click();
    await expect(
      hero.getByText("Still needs a person", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(hero.getByText("REVIEW_REQUIRED").filter({ visible: true })).toBeVisible();
  });

  test("hero: choosing another sample resets to its input", async ({ page }) => {
    await page.goto("/ai-data");
    const hero = page.locator("#aid-hero-workflow");
    await hero.getByRole("button", { name: /^Next: Read/ }).click();
    await hero.getByRole("button", { name: "Supplier invoice" }).click();
    await expect(hero.getByRole("button", { name: "Supplier invoice" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(hero.getByRole("heading", { name: "Step 1 of 4: Input" })).toBeVisible();
    await expect(hero.getByText("Calder Fixings Ltd (fictional)")).toBeVisible();
  });

  test("the expanded view is a dialog that traps focus and returns it to its button", async ({
    page,
  }) => {
    await page.goto("/ai-data");
    // The dialog code is not part of the first load.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const opener = page.getByRole("button", { name: "Open full view" });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /Supplier statement reconciliation/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Scripted example, not live AI").first()).toBeVisible();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(
        true,
      );
    }
    await dialog.getByRole("button", { name: "Copy result as JSON" }).click();
    await expect(page.getByText("Result copied").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("explorer: choosing a work type shows its panel and a link carrying its topic slug", async ({
    page,
  }) => {
    await page.goto("/ai-data");
    const first = page.getByRole("radio", { name: /Reconciling finance records/ });
    await expect(first).toBeChecked();
    await page.getByText("Handling requests and enquiries").click();
    const panel = page.locator("[data-panel=customer-requests]");
    await expect(panel).toBeVisible();
    await expect(page.locator("[data-panel=finance-reconciliation]")).toBeHidden();
    await expect(panel.getByRole("link", { name: /Prepare a brief/ })).toHaveAttribute(
      "href",
      "/ai-data/contact?topic=customer-requests",
    );
  });

  test("the reconciliation preview expands evidence for a result", async ({ page }) => {
    await page.goto("/ai-data");
    const preview = page.locator("section[aria-labelledby=aid-preview]");
    const row = preview.getByRole("button", { name: /INV-40127/ });
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(preview.getByText("Ledger shows £398.00")).toBeVisible();
  });

  test("primary and secondary calls to action work", async ({ page }) => {
    await page.goto("/ai-data");
    await page.getByRole("link", { name: "Explore your workflow" }).click();
    await expect(page).toHaveURL(/#aid-explorer$/);
    await page.goto("/ai-data");
    await expect(page.getByRole("link", { name: "Try a working example" })).toHaveAttribute(
      "href",
      "/ai-data/demonstrator",
    );
    await expect(page.getByRole("link", { name: "Prepare a workflow brief" })).toHaveAttribute(
      "href",
      "/ai-data/contact",
    );
  });
});

test.describe("demonstrator", () => {
  test("select a sample, expand evidence, see the exception highlighted in the source", async ({
    page,
  }) => {
    await page.goto("/ai-data/demonstrator");
    await page.getByRole("button", { name: /Missing invoice and amount difference/ }).click();
    const row = page.getByRole("button", { name: /INV-3102/ });
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    const marked = page.locator('[data-line="l6"][data-marked]').first();
    await expect(marked).toContainText("INV-3102");
    await expect(page.getByText("Not on statement").first()).toBeVisible();
    await page.getByRole("button", { name: /Exceptions 3/ }).click();
    await expect(page.locator("li[data-status=matched]")).toHaveCount(0);
  });

  test("popover and reviewer drawer load on demand, take focus and give it back", async ({
    page,
  }) => {
    await page.goto("/ai-data/demonstrator");
    const info = page.getByRole("button", { name: "About the final state" });
    await info.click();
    const popover = page.getByRole("dialog", { name: "Final state" });
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(page.getByRole("button", { name: "About the final state" })).toBeFocused();

    await page.getByRole("button", { name: /INV-40127/ }).click();
    await page
      .getByRole("button", { name: "See the reviewer task" })
      .filter({ visible: true })
      .click();
    const drawer = page.getByRole("dialog", { name: /Reviewer task: INV-40127/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("The reviewer decides")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "See the reviewer task" }).filter({ visible: true }),
    ).toBeFocused();
  });

  test("evaluation detail is in a secondary Evidence section and AC-14 stays not run", async ({
    page,
  }) => {
    await page.goto("/ai-data/demonstrator");
    const evidence = page.locator("section[aria-labelledby=aid-evidence]");
    await expect(evidence.getByRole("heading", { name: /Offline evaluation/ })).toBeVisible();
    await expect(evidence.getByText("AC-14").first()).toBeVisible();
    await expect(evidence.getByText("Not run").first()).toBeVisible();
  });
});

test.describe("responsive", () => {
  for (const width of [320, 390, 768]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/ai-data",
        "/ai-data/demonstrator",
        "/ai-data/solutions",
        "/ai-data/approach",
      ]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});
