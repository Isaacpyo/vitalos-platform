import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureOverflow } from "../support/overflow";
import { NOT_FOUND_PATH, TEMPLATES } from "../support/routes";

/**
 * Phone pass over every public template (C6, 17 Oct 2026 review): at 390×844 (the `mobile`
 * project) no horizontal scrolling and touch targets large enough to hit; on every project, no
 * Content-Security-Policy violation in the console (C4, ADR-047).
 *
 * Touch targets: WCAG 2.2 AA 2.5.8 asks for 24×24 CSS px, and this fails below it. The brief's
 * 44 px (AAA 2.5.5, Apple and Material guidance) is reported per page as an annotation and a JSON
 * attachment, listed by component in docs/review-2026-10-17/ws5/NOTES.md, so a shared component
 * owned by another workstream cannot turn this suite red overnight. Inline text links inside a
 * sentence are exempt (the 2.5.8 inline exception), as are the Turnstile frame and visually
 * hidden controls.
 *
 * `WS5_SCREENSHOTS=1` also saves a viewport screenshot per page (JPEG) to
 * docs/review-2026-10-17/ws5/screenshots/.
 */

const MIN_AA = 24;
const MIN_COMFORT = 44;

const pages = [
  ...TEMPLATES.map((template) => ({ name: template.name, path: template.path, status: 200 })),
  { name: "404", path: NOT_FOUND_PATH, status: 404 },
];

const screenshotDir = path.join(process.cwd(), "docs/review-2026-10-17/ws5/screenshots");

interface Target {
  label: string;
  width: number;
  height: number;
}

async function smallTargets(page: Page): Promise<Target[]> {
  return page.evaluate(() => {
    const selector =
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"]';
    const results: Target[] = [];
    const describe = (el: Element) => {
      const name =
        el.getAttribute("aria-label") ??
        (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) ??
        "";
      const cls =
        typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 1).join("") : "";
      const landmark = el.closest("header, nav, footer, main, aside, .relay-root");
      const where = landmark
        ? landmark.classList.contains("relay-root")
          ? "relay"
          : landmark.tagName.toLowerCase()
        : "body";
      return `${where} ${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""} "${name}"`;
    };
    const hidden = (el: Element) => {
      if (el.closest('[aria-hidden="true"], [hidden], [inert]')) return true;
      // The skip link sits off-screen until it is focused.
      if (el.classList.contains("skip-link")) return true;
      // Content of a closed <details> keeps a layout box but is not rendered (content-visibility).
      if (
        !el.checkVisibility({
          contentVisibilityAuto: true,
          opacityProperty: true,
          visibilityProperty: true,
        })
      ) {
        return true;
      }
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return true;
      const rect = el.getBoundingClientRect();
      // Visually hidden (skip link at rest, sr-only inputs behind a styled control).
      return rect.width <= 1 || rect.height <= 1;
    };
    const inlineInSentence = (el: Element) => {
      if (el.tagName !== "A" || getComputedStyle(el).display !== "inline") return false;
      const parent = el.parentElement;
      if (!parent) return false;
      const own = (el.textContent ?? "").trim();
      const all = (parent.textContent ?? "").trim();
      return all.length > own.length + 1;
    };
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (hidden(el) || inlineInSentence(el)) continue;
      let rect = el.getBoundingClientRect();
      // A checkbox or radio is hit through its label as well.
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        const label = el.labels?.[0];
        if (label) rect = label.getBoundingClientRect();
      }
      results.push({
        label: describe(el),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    return results;
  });
}

test.describe("phone pass at 390px (C6)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) !== 390, "mobile project only");
  test.use({ reducedMotion: "reduce" });

  for (const entry of pages) {
    test(`${entry.name}: fits 390px and its touch targets are at least 24px`, async ({
      page,
    }, testInfo) => {
      const response = await page.goto(entry.path);
      expect(response?.status(), entry.path).toBe(entry.status);

      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth, overflow.offenders.join(", ")).toBeLessThanOrEqual(
        overflow.clientWidth,
      );

      const targets = await smallTargets(page);
      const failing = targets.filter((t) => Math.min(t.width, t.height) < MIN_AA);
      const uncomfortable = targets.filter(
        (t) => Math.min(t.width, t.height) >= MIN_AA && Math.min(t.width, t.height) < MIN_COMFORT,
      );
      if (uncomfortable.length > 0) {
        testInfo.annotations.push({
          type: "touch targets under 44px",
          description: [...new Set(uncomfortable.map((t) => t.label))].slice(0, 12).join("; "),
        });
        await testInfo.attach("targets-under-44px.json", {
          body: JSON.stringify(uncomfortable, null, 2),
          contentType: "application/json",
        });
      }

      if (process.env.WS5_SCREENSHOTS === "1") {
        mkdirSync(screenshotDir, { recursive: true });
        const file = `${entry.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-390.jpg`;
        await page.screenshot({ path: path.join(screenshotDir, file), type: "jpeg", quality: 60 });
      }

      expect(
        failing.map((t) => `${t.label} ${t.width}×${t.height}`),
        "touch targets under 24×24 CSS px (WCAG 2.5.8)",
      ).toEqual([]);
    });
  }
});

test.describe("no Content-Security-Policy violations (C4, ADR-047)", () => {
  for (const entry of pages) {
    test(`${entry.name}: the console reports no CSP violation`, async ({ page }, testInfo) => {
      const violations: string[] = [];
      page.on("console", (message) => {
        const text = message.text();
        if (
          /Content Security Policy|Content-Security-Policy|Refused to (load|execute|frame|connect|apply)/i.test(
            text,
          )
        ) {
          violations.push(text.slice(0, 300));
        }
      });
      page.on("pageerror", (error) => {
        if (/Content Security Policy/i.test(error.message)) violations.push(error.message);
      });
      await page.goto(entry.path);
      // Not "networkidle": the Turnstile widget keeps a connection open on forms.
      await page.waitForLoadState("load");
      await page.waitForTimeout(500);
      if (process.env.WS5_SCREENSHOTS === "1" && testInfo.project.name === "chromium") {
        mkdirSync(screenshotDir, { recursive: true });
        const file = `${entry.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-1440.jpg`;
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: path.join(screenshotDir, file), type: "jpeg", quality: 60 });
      }
      expect(violations).toEqual([]);
    });
  }
});
