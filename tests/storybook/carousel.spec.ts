import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Carousel paging in a real browser (ADR-024). Runs against the static Storybook build because
 * the fixture site has too few industries to overflow the row; the story has seven items, and the
 * desktop project (1280px) lays them out as the scroll-snap row (four per view).
 */
const story = "/iframe.html?id=patterns-presentation--carousel-row&viewMode=story";

test.use({ reducedMotion: "reduce" });

async function open(page: Page) {
  await page.goto(story);
  await expect(page.locator("body.sb-show-main")).toBeAttached();
  const list = page.getByRole("region", { name: "Example items (fixture)" }).getByRole("list");
  await expect(list).toBeVisible();
  return list;
}

const scrollLeft = (page: Page) =>
  page
    .getByRole("region", { name: "Example items (fixture)" })
    .getByRole("list")
    .evaluate((element) => element.scrollLeft);

test("arrow keys, Home and End move focus and page the row", async ({ page }) => {
  await open(page);
  const first = page.getByRole("link", { name: "Example item 1 (fixture)" });
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("link", { name: "Example item 2 (fixture)" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("link", { name: "Example item 7 (fixture)" })).toBeFocused();
  await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0);
  // The last item is fully in view after End.
  const box = await page.getByRole("link", { name: "Example item 7 (fixture)" }).boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    (page.viewportSize()?.width ?? 0) + 1,
  );
  await page.keyboard.press("Home");
  await expect(first).toBeFocused();
  await expect.poll(() => scrollLeft(page)).toBe(0);
});

test("the paging buttons page by one item and disable at either end", async ({ page }) => {
  await open(page);
  const previous = page.getByRole("button", { name: "Previous: Example items (fixture)" });
  const next = page.getByRole("button", { name: "Next: Example items (fixture)" });
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await next.click();
  await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0);
  await expect(previous).toBeEnabled();
  // Page on to the end, one item per press; each press must move the row, and the Next button is
  // enabled exactly until the last item is in view.
  const list = page.getByRole("region", { name: "Example items (fixture)" }).getByRole("list");
  let atEnd = false;
  for (let i = 0; i < 8 && !atEnd; i += 1) {
    const before = await scrollLeft(page);
    await next.click();
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(before);
    atEnd = await list.evaluate(
      (element) => element.scrollLeft + element.clientWidth >= element.scrollWidth - 4,
    );
    if (!atEnd) await expect(next).toBeEnabled();
  }
  expect(atEnd).toBe(true);
  await expect(next).toBeDisabled();
});

test("a mouse drag scrolls the row and does not follow the link it started on", async ({
  page,
}) => {
  const list = await open(page);
  const box = await list.boundingBox();
  if (!box) throw new Error("carousel list has no box");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0);
  // Still on the story: the click that ended the drag was swallowed.
  expect(page.url()).toContain("carousel-row");
});
