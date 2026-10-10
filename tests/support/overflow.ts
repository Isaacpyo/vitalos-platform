import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** WCAG 2.2 SC 1.4.10 Reflow: content must fit a 320 CSS px wide viewport without sideways scroll. */
export const REFLOW_WIDTH = 320;

export interface OverflowReport {
  scrollWidth: number;
  clientWidth: number;
  /** Elements whose right edge passes the viewport (first few, for diagnosis). */
  offenders: string[];
}

export async function measureOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const viewport = root.clientWidth;
    const offenders: string[] = [];
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.right > viewport + 1 && offenders.length < 8) {
        const id = element.id ? `#${element.id}` : "";
        const cls =
          typeof element.className === "string" && element.className
            ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
            : "";
        offenders.push(`${element.tagName.toLowerCase()}${id}${cls}`);
      }
    }
    return { scrollWidth: root.scrollWidth, clientWidth: viewport, offenders };
  });
}

/** Resizes to 320px and asserts the page does not scroll horizontally. */
export async function expectNoHorizontalOverflowAt320(page: Page) {
  await page.setViewportSize({ width: REFLOW_WIDTH, height: 800 });
  const report = await measureOverflow(page);
  expect(
    report.scrollWidth,
    `Horizontal overflow at ${REFLOW_WIDTH}px on ${page.url()}: scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}; offenders: ${report.offenders.join(", ") || "none found"}`,
  ).toBeLessThanOrEqual(report.clientWidth);
}
