import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** WCAG 2.2 AA is the Vitalos target (Stage 9 §34): include every lower level it builds on. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

export interface A11yOptions {
  /** CSS selectors to limit the scan to. */
  include?: readonly string[];
  /** CSS selectors to leave out (third-party widgets only; justify at the call site). */
  exclude?: readonly string[];
  /** Axe rule ids to disable. Justify each one at the call site; prefer fixing the page. */
  disableRules?: readonly string[];
}

export async function scanA11y(page: Page, options: A11yOptions = {}) {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_TAGS]);
  for (const selector of options.include ?? []) builder = builder.include(selector);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  if (options.disableRules?.length) builder = builder.disableRules([...options.disableRules]);
  // Storybook's a11y addon runs its own axe pass when a story renders, and axe refuses to start
  // a second run concurrently. Retry only on that specific error.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await builder.analyze();
    } catch (error) {
      const busy = error instanceof Error && error.message.includes("Axe is already running");
      if (!busy || attempt >= 10) throw error;
      await page.waitForTimeout(250);
    }
  }
}

/** Fails with a readable list of violations (rule, impact, help URL, offending nodes). */
export async function expectNoA11yViolations(page: Page, options: A11yOptions = {}) {
  const { violations } = await scanA11y(page, options);
  const summary = violations.map((violation) => {
    const nodes = violation.nodes
      .slice(0, 5)
      .map((node) => `    ${node.target.join(" ")}`)
      .join("\n");
    return `- ${violation.id} (${violation.impact ?? "n/a"}): ${violation.help}\n  ${violation.helpUrl}\n${nodes}`;
  });
  expect(violations, `Accessibility violations on ${page.url()}\n${summary.join("\n")}`).toEqual(
    [],
  );
}
