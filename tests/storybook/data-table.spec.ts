import { expect, test } from "@playwright/test";

const story = "/iframe.html?id=patterns-labs--rich-text-data-table&viewMode=story";

test.describe("stacked data table labels", () => {
  test("at 320px the label is shown but is not part of the cell's accessible name", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(story);
    const table = page.getByRole("table", { name: "Example data table (fixture)" });
    await table.waitFor();
    const cell = table.getByRole("cell").first();
    const before = await cell.evaluate((el) => {
      const style = getComputedStyle(el, "::before");
      return { content: style.content, display: style.display };
    });
    expect(before.content).toContain("Example value (fixture)");
    expect(before.display).toBe("block");
    await expect(cell).toHaveAccessibleName("00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    await table.screenshot({ path: testInfo.outputPath("data-table-320.png") });
  });
});
