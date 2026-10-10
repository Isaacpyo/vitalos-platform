import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";
import { NOT_FOUND_PATH, TEMPLATES } from "../support/routes";

/**
 * Accessibility sweep over EVERY page template (WCAG 2.2 AA, ADR-021), driven by the route
 * manifest in tests/support/routes.ts so no template can be added without being scanned. The
 * `chromium` project scans at 1440px, the `mobile` project at 390px; reflow at 320px is checked
 * on both. Family-specific assertions (structured data, headings, content rules) live in the
 * end-to-end specs; this file owns the cross-cutting accessibility properties.
 */

// The site uses smooth scrolling, which keeps scroll-into-view assertions from settling; the
// "reduced motion" describe below checks that this switch is what turns it off.
test.use({ reducedMotion: "reduce" });

const pages = [
  ...TEMPLATES.map((template) => ({ name: template.name, path: template.path, status: 200 })),
  { name: "404", path: NOT_FOUND_PATH, status: 404 },
];

// The Turnstile iframe is Cloudflare's document and is not ours to fix.
const exclude = ['iframe[src*="challenges.cloudflare.com"]'];

async function open(page: Page, path: string, status: number) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(status);
  // Desktop scans use a wide viewport; the mobile project keeps its 390px emulation.
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page.setViewportSize({ width: 1440, height: 900 });
  }
}

test.describe("axe on every template", () => {
  for (const entry of pages) {
    test(`${entry.name}: no WCAG 2.2 AA violations, one h1, one main`, async ({ page }) => {
      await open(page, entry.path, entry.status);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expectNoA11yViolations(page, { exclude });
    });
  }
});

test.describe("reflow at 320px on every template (WCAG 1.4.10)", () => {
  for (const entry of pages) {
    test(`${entry.name}: no horizontal scrolling`, async ({ page }) => {
      await open(page, entry.path, entry.status);
      await expectNoHorizontalOverflowAt320(page);
    });
  }
});

test.describe("reduced motion is respected", () => {
  const sample = ["/", "/what-we-do/example-practice", "/labs", "/trust", "/contact"];

  for (const path of sample) {
    test(`${path}: no smooth scrolling, no running animation or long transition`, async ({
      page,
    }) => {
      await open(page, path, 200);
      const report = await page.evaluate(() => {
        const longTransitions: string[] = [];
        for (const element of Array.from(document.querySelectorAll("body, body *"))) {
          const style = getComputedStyle(element);
          const durations = style.transitionDuration.split(",").map((value) => {
            const n = parseFloat(value);
            return value.trim().endsWith("ms") ? n : n * 1000;
          });
          if (durations.some((ms) => ms > 1)) {
            longTransitions.push(element.tagName.toLowerCase());
          }
        }
        const running = document
          .getAnimations()
          .filter((animation) => animation.playState === "running")
          .map((animation) => animation.effect?.getComputedTiming().duration)
          .filter((duration) => typeof duration === "number" && duration > 1);
        return {
          scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
          longTransitions: longTransitions.slice(0, 5),
          running,
        };
      });
      expect(report.scrollBehavior).toBe("auto");
      expect(report.longTransitions, "elements with a transition longer than 1ms").toEqual([]);
      expect(report.running, "animations running longer than 1ms").toEqual([]);
    });
  }

  test("the same page does animate scrolling when motion is allowed", async ({ page }) => {
    // Proves the checks above are meaningful: the media query, not the markup, switches it off.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
    ).toBe("smooth");
  });
});

test.describe("focus is not obscured by the sticky header (WCAG 2.4.11)", () => {
  /**
   * Returns a description of the focused element when it is hidden behind the sticky header or
   * any other element that sits on top of it, otherwise null. Elements inside the header (and the
   * skip link, which is designed to appear over it) are exempt.
   */
  async function obscuredFocus(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) return null;
      const header = document.querySelector("header");
      if (header?.contains(active)) return null;
      if (active.classList.contains("skip-link") || active.matches('a[href="#main"]')) return null;
      const rect = active.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const label = `${active.tagName.toLowerCase()}[${(active.textContent ?? "").trim().slice(0, 30)}]`;
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      if (rect.top < headerBottom - 0.5) {
        return `${label} top ${Math.round(rect.top)} is under the header (bottom ${Math.round(headerBottom)})`;
      }
      // Whatever is painted at the element's centre must be the element (or part of it).
      const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
      const y = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
      const top = document.elementFromPoint(x, y);
      if (top && !active.contains(top) && !top.contains(active)) {
        return `${label} is covered by ${top.tagName.toLowerCase()}.${String(top.className).slice(0, 40)}`;
      }
      return null;
    });
  }

  const focusPages = [
    "/",
    "/what-we-do/example-practice",
    "/offers/example-offer",
    "/insights/example-insight-1",
    "/work/example-case-study",
    "/trust/procurement",
    "/labs/open-source/example-open-source-tool",
    "/legal/privacy",
    "/contact",
  ];

  for (const path of focusPages) {
    test(`${path}: tabbing forwards and backwards never lands under the header`, async ({
      page,
    }) => {
      await open(page, path, 200);
      const stops = await page.evaluate(
        () =>
          document.querySelectorAll(
            'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select, textarea, summary, [tabindex="0"]',
          ).length,
      );
      const limit = Math.min(stops + 2, 120);
      const problems: string[] = [];
      for (let i = 0; i < limit; i += 1) {
        await page.keyboard.press("Tab");
        const problem = await obscuredFocus(page);
        if (problem) problems.push(`Tab ${i + 1}: ${problem}`);
      }
      for (let i = 0; i < limit; i += 1) {
        await page.keyboard.press("Shift+Tab");
        const problem = await obscuredFocus(page);
        if (problem) problems.push(`Shift+Tab ${i + 1}: ${problem}`);
      }
      expect(problems.slice(0, 6)).toEqual([]);
    });

    test(`${path}: an element focused while scrolled just under the header is brought clear of it`, async ({
      page,
    }) => {
      await open(page, path, 200);
      // For a spread of focusable elements, scroll so that each sits half under the header, then
      // focus it the way a script, a skip link or a validation summary would.
      const count = await page
        .locator("main a[href], main button, main input, main select")
        .count();
      const picks = [...new Set([0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.floor(f * (count - 1))))];
      const problems: string[] = [];
      for (const index of picks) {
        const target = page
          .locator("main a[href], main button, main input, main select")
          .nth(index);
        if (!(await target.isVisible())) continue;
        await target.evaluate((element) => {
          const header = document.querySelector("header");
          const height = header ? header.getBoundingClientRect().height : 0;
          const top = element.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, Math.max(0, top - height / 2));
          (element as HTMLElement).focus({ preventScroll: false });
        });
        const problem = await obscuredFocus(page);
        if (problem) problems.push(problem);
      }
      expect(problems).toEqual([]);
    });
  }
});
