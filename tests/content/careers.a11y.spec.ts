import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { CAREERS_PAGES, stubMedia } from "./support/media";

/**
 * axe (WCAG 2.2 AA) on every Careers page, including the role page's form, at 1440 px and at
 * 390 px (review 17 Oct 2026, B7): each page, the form with its errors, and the confirmation.
 */

/**
 * Sends the website's own careers requests from the given client address (the site allows 5 CV
 * uploads an hour per address, and other suites spend that). Only the website's routes: the
 * admin's upload URL takes no extra headers (CORS).
 */
async function sendFrom(page: Page, ip: string): Promise<void> {
  await page.route(
    (url) =>
      url.pathname.startsWith("/api/careers/") && !url.pathname.startsWith("/api/careers/v1/"),
    (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }),
  );
}

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

/** A small valid PDF (the fake admin checks the `%PDF-` magic bytes). */
const pdf = () => {
  const buffer = Buffer.alloc(2048, 0x20);
  buffer.write("%PDF-1.7\n");
  return { name: "example-cv.pdf", mimeType: "application/pdf", buffer };
};

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name} px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const { name, path } of CAREERS_PAGES) {
      test(`axe: ${name}`, async ({ page }) => {
        await stubMedia(page);
        await page.goto(path);
        await expectNoA11yViolations(page);
      });
    }

    test("axe: the form with its errors shown", async ({ page }) => {
      await page.goto("/careers/example-role-fixture");
      await page.getByRole("button", { name: "Send application" }).click();
      await page.locator("main").getByRole("alert").first().waitFor();
      await expectNoA11yViolations(page);
    });

    test("axe: the confirmation after sending", async ({ page }) => {
      // Its own client address, so the site's per-address limit (5 CV uploads an hour) is not
      // spent by the other suites' applications.
      await sendFrom(page, `198.51.100.${viewport.width % 250}`);
      await page.goto("/careers/example-role-fixture");
      await page.locator('input[type="file"]').setInputFiles(pdf());
      await page.getByText("example-cv.pdf, 2 KB").waitFor();
      await page.getByLabel("Full name").fill("Example Applicant");
      await page.getByLabel("Email", { exact: true }).fill("applicant@example.test");
      await page.getByLabel("Yes", { exact: true }).check();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Send application" }).click();
      // The confirmation dialog (#72) opens first; the page's own receipt follows when it closes.
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: "Application received." }).waitFor();
      await dialog.getByRole("button", { name: "Close" }).click();
      await page.getByRole("heading", { name: "What happens next" }).waitFor();
      await expectNoA11yViolations(page);
    });
  });
}
