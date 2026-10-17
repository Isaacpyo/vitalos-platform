import { expect, test } from "@playwright/test";
import { isDraftRun } from "../support/content-source";
import type { Page } from "@playwright/test";
import { waitForSettledLayout } from "../support/overflow";
import { CURRENT_NAV_ONLY, isIaRun } from "../support/nav-variant";

/**
 * Motion and navigation enhancements (ADR-024), in a real browser against the production build.
 * Runs on the desktop and 390px projects; tests that need a particular width set it themselves.
 *
 * What this file proves:
 * - under reduced motion nothing animates, nothing is held back for an entrance, and the page
 *   does not move as it is scrolled (and, as a control, that the same page does animate when
 *   motion is allowed, so the reduced-motion checks are meaningful);
 * - the compact menu sheet is modal while open: focus is trapped, the page behind it is inert and
 *   does not scroll, Escape closes it and focus returns to the trigger;
 * - the tablet sheet is the two-column state, and the primary action stays in the bar at every
 *   compact width; the Trust Centre is not in the bar (footer only, 15 Oct 2026);
 * - the header condenses on scroll without moving the content below it.
 */

/** Finite animations still running, plus any Reveal currently held back or mid-entrance. */
async function motionReport(page: Page) {
  return page.evaluate(() => ({
    running: document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .map((animation) => animation.effect?.getComputedTiming().duration)
      .filter((duration) => typeof duration === "number" && duration > 1),
    moving: Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-state]"))
      .map((element) => element.dataset["revealState"])
      .filter((state) => state !== "static"),
    inlineMotion: Array.from(document.querySelectorAll<HTMLElement>("main [style]"))
      .map((element) => element.style.transform)
      .filter((transform) => transform !== "" && transform !== "none"),
  }));
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(30);
  }
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  // A practice page from the content source under test (ADR-025 draft slugs differ).
  const practice = isDraftRun ? "/what-we-do/engineering" : "/what-we-do/example-practice";
  for (const path of ["/", "/how-we-work", practice]) {
    test(`${path}: nothing animates, nothing is held back, nothing moves while scrolling`, async ({
      page,
    }) => {
      await page.goto(path);
      await scrollThrough(page);
      const report = await motionReport(page);
      expect(report.running, "animations running longer than 1ms").toEqual([]);
      expect(report.moving, "reveals that left their static state").toEqual([]);
      expect(report.inlineMotion, "inline transforms set by a motion island").toEqual([]);
    });
  }

  test("opening and closing the menus starts no animation", async ({ page }) => {
    await page.goto("/");
    const compact = (page.viewportSize()?.width ?? 0) < 1024;
    if (compact) {
      await page.getByRole("banner").locator("summary", { hasText: "Menu" }).click();
    } else {
      await page.getByRole("button", { name: "What We Do menu" }).click();
    }
    const report = await motionReport(page);
    expect(report.running).toEqual([]);
  });
});

test.describe("motion allowed (control)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("content below the fold is held back, then rises in once and ends unclipped", async ({
    page,
  }) => {
    await page.goto("/");
    // Hydration marks the below-the-fold reveals as hidden (they are off screen).
    await expect(page.locator('[data-reveal-state="hidden"]').first()).toBeAttached();
    // Nothing on the first screen is ever held back.
    const heldOnScreen = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-reveal-state="hidden"]')).filter(
          (element) => element.getBoundingClientRect().top < window.innerHeight,
        ).length,
    );
    expect(heldOnScreen).toBe(0);
    await scrollThrough(page);
    await expect(page.locator('[data-reveal-state="hidden"]')).toHaveCount(0);
    // Every entrance finishes without a clip left behind, and never used opacity.
    await expect
      .poll(() =>
        page
          .evaluate(() =>
            Array.from(
              document.querySelectorAll<HTMLElement>('[data-reveal-state="shown"]'),
            ).filter(
              (element) => element.style.clipPath !== "" && element.style.clipPath !== "none",
            ),
          )
          .then((list) => list.length),
      )
      .toBe(0);
    const faded = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-state]")).filter(
          (element) => element.style.opacity !== "",
        ).length,
    );
    expect(faded).toBe(0);
  });
});

test.describe("held-back content is never left clipped (motion allowed)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("printing without scrolling prints every section unclipped", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-reveal-state="hidden"]').first()).toBeAttached();
    await page.emulateMedia({ media: "print" });
    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-state], [data-reveal-item]"))
        .map((element) => {
          const style = getComputedStyle(element);
          return { clip: style.clipPath, transform: style.transform };
        })
        .filter(({ clip, transform }) => clip !== "none" || transform !== "none"),
    );
    expect(clipped).toEqual([]);
  });

  test("Tab into a held-back section shows it and its focused link is unclipped", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    // The first link inside a section that is still held back below the fold, pinned with a marker
    // (the selector stops matching it once its section is shown).
    await expect(page.locator('[data-reveal-state="hidden"] a[href]').first()).toBeAttached();
    await page
      .locator('[data-reveal-state="hidden"] a[href]')
      .first()
      .evaluate((link) => link.setAttribute("data-e2e-focus-target", ""));
    const target = page.locator("[data-e2e-focus-target]");
    // Focus the control just before it in the tab order, then Tab onto it like a keyboard user.
    await target.evaluate((link) => {
      const all = Array.from(
        document.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), summary"),
      ).filter((element) => element.getClientRects().length > 0);
      const index = all.indexOf(link as HTMLElement);
      all[index - 1]?.focus({ preventScroll: true });
    });
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    await expect
      .poll(() =>
        target.evaluate((link) => {
          const host = link.closest<HTMLElement>("[data-reveal-state]");
          const rect = link.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return {
            state: host?.dataset["revealState"],
            clip: host ? getComputedStyle(host).clipPath : "none",
            visible: Boolean(hit && (link === hit || link.contains(hit))),
          };
        }),
      )
      .toEqual({ state: "shown", clip: "none", visible: true });
  });

  test("a short last section is shown once the page is scrolled to the bottom", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("End");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator('[data-reveal-state="hidden"]')).toHaveCount(0);
  });
});

test.describe("compact menu sheet", () => {
  test.use({ reducedMotion: "reduce" });

  test("is modal while open: focus trapped, page inert and still, Escape closes, focus returns", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const header = page.getByRole("banner");
    const summary = header.locator("summary", { hasText: "Menu" });
    await summary.click();
    await expect(header.getByRole("navigation", { name: "Primary" })).toBeVisible();

    expect(await page.locator("main").evaluate((element) => element.inert)).toBe(true);
    expect(await page.locator("footer").evaluate((element) => element.inert)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
      "hidden",
    );

    // Tab well past the number of controls in the sheet: focus never leaves the menu component
    // (the bar's primary action, the trigger and the sheet; everything else is inert).
    const details = header.locator("details").first();
    const menu = details.locator("xpath=..");
    const stops = await menu.locator("a[href], summary").count();
    for (let i = 0; i < stops + 3; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await menu.evaluate((root) => root.contains(document.activeElement));
      expect(inside, `Tab ${i + 1} left the menu`).toBe(true);
    }
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Shift+Tab");
      const inside = await menu.evaluate((root) => root.contains(document.activeElement));
      expect(inside, `Shift+Tab ${i + 1} left the menu`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(details).not.toHaveJSProperty("open", true);
    await expect(summary).toBeFocused();
    expect(await page.locator("main").evaluate((element) => element.inert)).toBe(false);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe(
      "hidden",
    );
  });

  test("closes itself when the viewport grows into the desktop navigation", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto("/");
    await page.getByRole("banner").locator("summary", { hasText: "Menu" }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole("banner").locator("details").first()).not.toHaveJSProperty(
      "open",
      true,
    );
    expect(await page.locator("main").evaluate((element) => element.inert)).toBe(false);
    // Focus (on the trigger, which is hidden at this width) moves to a visible header control,
    // never to <body>.
    const focused = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        inHeader: Boolean(active && document.querySelector("header")?.contains(active)),
        visible: Boolean(active && active.getClientRects().length > 0),
      };
    });
    expect(focused).toEqual({ inHeader: true, visible: true });
  });

  test("on a tablet the sheet has two columns with the section groups open", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto("/");
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Primary" });
    await page.getByRole("banner").locator("summary", { hasText: "Menu" }).click();
    // No nested disclosure to open: How We Work is visible straight away, beside the rows.
    const row = nav.getByRole("link", { name: "What We Do", exact: true });
    const group = nav.getByRole("link", { name: "How We Work", exact: true });
    await expect(row).toBeVisible();
    await expect(group).toBeVisible();
    const rowBox = await row.boundingBox();
    const groupBox = await group.boundingBox();
    expect((groupBox?.x ?? 0) > (rowBox?.x ?? 0) + (rowBox?.width ?? 0)).toBe(true);
    await expect(nav.getByRole("link", { name: "Trust Centre" })).toHaveCount(0);
  });
});

test.describe("header", () => {
  test.use({ reducedMotion: "reduce" });

  for (const width of [320, 390, 834]) {
    test(`at ${width}px the primary action is in the bar, beside the menu trigger`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/what-we-do");
      const action = page.getByRole("banner").getByRole("link", { name: "Talk to Vitalos" });
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
      await expect(page.getByRole("banner").locator("summary", { hasText: "Menu" })).toBeVisible();
    });
  }

  test("at 1024px the bar has the three menus and no Trust Centre", async ({ page }) => {
    test.skip(isIaRun, CURRENT_NAV_ONLY);
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/");
    const banner = page.getByRole("banner");
    for (const label of ["What We Do", "Who We Are", "Support"]) {
      await expect(banner.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(banner.getByRole("link", { name: "Trust Centre", exact: true })).toHaveCount(0);
  });

  test("condenses once the page scrolls, without moving the content below it", async ({ page }) => {
    await page.goto("/how-we-work");
    const header = page.getByRole("banner");
    const tall = (await header.boundingBox())?.height ?? 0;
    const anchorTop = () =>
      page
        .locator("main h2")
        .first()
        .evaluate((element) => {
          return element.getBoundingClientRect().top + window.scrollY;
        });
    const before = await anchorTop();
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveAttribute("data-condensed", "");
    // The bar and the margin under it change over the reveal duration; measure the resting state,
    // not the first frame after the attribute flips.
    await waitForSettledLayout(page);
    const short = (await header.boundingBox())?.height ?? 0;
    expect(short).toBeLessThan(tall);
    // At most a third shorter, and still taller than a 44px target.
    expect(short).toBeGreaterThanOrEqual((tall * 2) / 3);
    expect(await anchorTop()).toBe(before);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).not.toHaveAttribute("data-condensed", "");
  });
});

test.describe("mobile fade-in (MobileReveal)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.describe("motion allowed", () => {
    test.use({ reducedMotion: "no-preference" });

    test("holds only what starts below the fold, and shows every band once scrolled", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator('[data-m-reveal="armed"]').first()).toBeAttached();
      const heldOnScreen = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[data-m-reveal="armed"]')).filter(
            (element) => element.getBoundingClientRect().top < window.innerHeight * 0.9,
          ).length,
      );
      expect(heldOnScreen).toBe(0);
      await scrollThrough(page);
      await expect(page.locator('[data-m-reveal="armed"]')).toHaveCount(0);
    });
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("holds nothing back", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("[data-m-reveal]")).toHaveCount(0);
    });
  });
});
