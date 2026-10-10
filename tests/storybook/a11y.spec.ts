import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";

interface IndexEntry {
  id: string;
  type: "story" | "docs";
  title: string;
  name: string;
}

const indexPath = resolve(__dirname, "../../apps/storybook/storybook-static/index.json");
if (!existsSync(indexPath)) {
  throw new Error(
    "apps/storybook/storybook-static/index.json not found. Run `corepack pnpm storybook:build` first.",
  );
}

const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
  v: number;
  entries: Record<string, IndexEntry>;
};
const stories = Object.values(index.entries).filter((entry) => entry.type === "story");

test("storybook index lists at least one story", () => {
  expect(stories.length).toBeGreaterThan(0);
});

for (const story of stories) {
  test(`${story.title} / ${story.name} has no axe violations`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
    // Storybook sets sb-show-main when the story has rendered and sb-show-errordisplay when it threw.
    await expect(page.locator("body.sb-show-main")).toBeAttached();
    await expect(page.locator("body.sb-show-errordisplay")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expectNoA11yViolations(page, {
      include: ["#storybook-root"],
      // A story renders a component fragment, not a page. Page-level rules (landmarks, a single
      // h1) are asserted against real templates by the page-level accessibility suites.
      disableRules: ["region", "landmark-one-main", "page-has-heading-one"],
    });
  });
}
