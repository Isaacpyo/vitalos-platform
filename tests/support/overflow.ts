import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** WCAG 2.2 SC 1.4.10 Reflow: content must fit a 320 CSS px wide viewport without sideways scroll. */
export const REFLOW_WIDTH = 320;

export interface OverflowReport {
  scrollWidth: number;
  clientWidth: number;
  /** Boxes whose right edge passes the viewport (first few, for diagnosis). */
  offenders: string[];
}

export async function measureOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const viewport = root.clientWidth;
    const offenders: string[] = [];
    const limit = 8;
    const describe = (element: Element) => {
      const id = element.id ? `#${element.id}` : "";
      const cls =
        typeof element.className === "string" && element.className
          ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
      return `${element.tagName.toLowerCase()}${id}${cls}`;
    };
    const passes = (rect: DOMRect) => rect.width > 0 && rect.right > viewport + 1;
    const visit = (scope: Document | ShadowRoot, prefix: string) => {
      for (const element of Array.from(scope.querySelectorAll("*"))) {
        if (offenders.length >= limit) return;
        const rect = element.getBoundingClientRect();
        if (passes(rect)) {
          offenders.push(`${prefix}${describe(element)} (right ${Math.round(rect.right)})`);
        }
        // Text that overflows a box which itself fits (long words, unbroken strings).
        for (const node of Array.from(element.childNodes)) {
          if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const textRect = range.getBoundingClientRect();
          if (passes(textRect) && !passes(rect) && offenders.length < limit) {
            offenders.push(
              `${prefix}text in ${describe(element)} (right ${Math.round(textRect.right)})`,
            );
          }
        }
        // Pseudo-elements are not in the DOM; flag positioned ones on boxes that clip nothing.
        for (const pseudo of ["::before", "::after"] as const) {
          const style = getComputedStyle(element, pseudo);
          if (style.content === "none" || style.content === "normal") continue;
          const width = Number.parseFloat(style.width);
          const left = Number.parseFloat(style.left);
          if (
            Number.isFinite(width) &&
            Number.isFinite(left) &&
            rect.left + left + width > viewport + 1 &&
            getComputedStyle(element).overflowX === "visible" &&
            offenders.length < limit
          ) {
            offenders.push(`${prefix}${describe(element)}${pseudo}`);
          }
        }
        if (element.shadowRoot) visit(element.shadowRoot, `${prefix}${describe(element)} >> `);
      }
    };
    visit(document, "");
    return { scrollWidth: root.scrollWidth, clientWidth: viewport, offenders };
  });
}

/**
 * Waits until the page has stopped moving: no finite Web Animation or CSS transition still running,
 * and the document width unchanged across two animation frames. A resize restarts transitions (header,
 * reveal and carousel islands), and measuring mid-flight reports a width the page never rests at.
 */
export async function waitForSettledLayout(page: Page) {
  await page.waitForFunction(
    () =>
      document.getAnimations().every((animation) => {
        // Looping ambient motion never finishes; only finite animations can leave layout mid-way.
        const iterations = animation.effect?.getComputedTiming().iterations ?? 1;
        return iterations === Infinity || (!animation.pending && animation.playState !== "running");
      }),
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const before = document.documentElement.scrollWidth;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(document.documentElement.scrollWidth === before)),
        );
      }),
    undefined,
    { timeout: 10_000 },
  );
}

/** Resizes to 320px and asserts the page does not scroll horizontally. */
export async function expectNoHorizontalOverflowAt320(page: Page) {
  await page.setViewportSize({ width: REFLOW_WIDTH, height: 800 });
  await waitForSettledLayout(page);
  const report = await measureOverflow(page);
  expect(
    report.scrollWidth,
    `Horizontal overflow at ${REFLOW_WIDTH}px on ${page.url()}: scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}; offenders: ${report.offenders.join(", ") || "none found"}`,
  ).toBeLessThanOrEqual(report.clientWidth);
}
