import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { stubMedia } from "./support/media";

const ADMIN = `http://127.0.0.1:${Number(process.env.CONTENT_E2E_ADMIN_PORT ?? 8799)}`;
const ROLE = "/careers/example-role-fixture";

test.beforeEach(async ({ page }) => stubMedia(page));

/** A small valid PDF (the fake admin checks the `%PDF-` magic bytes). */
const pdf = (size = 2048) => {
  const buffer = Buffer.alloc(size, 0x20);
  buffer.write("%PDF-1.7\n");
  return { name: "example-cv.pdf", mimeType: "application/pdf", buffer };
};

async function fillValid(page: Page) {
  await page.getByLabel("Full name").fill("Example Applicant");
  await page.getByLabel("Email").fill("applicant@example.test");
  await page.locator('input[type="file"]').setInputFiles(pdf());
  await page.getByLabel("Yes", { exact: true }).check();
  await page.getByRole("checkbox").check();
}

test.describe("Careers pages", () => {
  test("the careers page lists open roles by practice", async ({ page }) => {
    const response = await page.goto("/careers");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build what you advise.");
    await expect(page.getByRole("link", { name: "See open roles" })).toHaveAttribute(
      "href",
      "#open-roles",
    );
    await expect(page.getByRole("heading", { name: "How we work" })).toBeVisible();
    await expect(page.getByText("Engineering (1)")).toBeVisible();
    await expect(page.locator(`main a[href="${ROLE}"]`)).toBeVisible();
  });

  test("a role shows its facts, sections, apply anchor, form and JobPosting", async ({ page }) => {
    const response = await page.goto(ROLE);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example role (fixture)");
    await expect(page.getByText("PRACTICE", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "About the role" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Apply for this role" })).toHaveAttribute(
      "href",
      "#apply",
    );
    await expect(page.getByRole("button", { name: "Send application" })).toBeVisible();
    // The same Share menu as an article, with the role's canonical URL.
    await page.locator("summary", { hasText: "Share" }).click();
    await expect(
      page.getByRole("group", { name: "Share this role" }).getByRole("link", { name: /^LinkedIn/ }),
    ).toHaveAttribute("href", /share-offsite\/\?url=.*%2Fcareers%2Fexample-role-fixture$/);
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(
      "",
    );
    expect(ld).toContain('"@type":"JobPosting"');
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    const image = await page.request.get(new URL(og ?? "", page.url()).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    // The About strip ends the role: the six practices, with links to About and What We Do.
    const about = page.getByRole("region", { name: "About Vitalos" });
    await expect(about).toContainText(
      "Vitalos works through six practices: Consulting, Engineering, AI & Data, Experience, Managed Services and Labs.",
    );
    await expect(about.getByRole("link", { name: "About Vitalos" })).toHaveAttribute(
      "href",
      "/about",
    );
    // The fixture's hiring process is empty, so there is no process block.
    await expect(page.getByRole("heading", { name: "How we hire" })).toHaveCount(0);
  });

  test("a closed role keeps its page without a form, noindex", async ({ page }) => {
    const response = await page.goto("/careers/closed-role");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("This role closed on 30 November 2026.")).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    await expect(page.locator("summary", { hasText: "Share" })).toHaveCount(0);
  });

  test("an old slug answers 308 and an unknown role a server-rendered 404", async ({ request }) => {
    const moved = await request.get("/careers/old-role", { maxRedirects: 0 });
    expect(moved.status()).toBe(308);
    expect(moved.headers()["location"]).toMatch(/\/careers\/example-role-fixture$/);
    const missing = await request.get("/careers/paused-role");
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain("<main");
  });

  test("the homepage shows the Careers section after Insights", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "All open roles" })).toBeVisible();
    await expect(page.locator(`main a[href="${ROLE}"]`)).toHaveCount(1);
    await expect(page.locator('footer a[href="/careers"]').first()).toBeAttached();
  });
});

test.describe("Application form", () => {
  test("applies with a PDF: the CV goes straight to the admin, then the application", async ({
    page,
  }) => {
    await page.goto(ROLE);
    await fillValid(page);
    await expect(page.getByText("example-cv.pdf, 2 KB")).toBeVisible();
    const upload = page.waitForRequest(
      (r) => r.url().startsWith(`${ADMIN}/api/careers/v1/uploads/`) && r.method() === "PUT",
    );
    await page.getByRole("button", { name: "Send application" }).click();
    await upload;
    const success = page.getByRole("heading", { name: "Application received." });
    await expect(success).toBeVisible();
    await expect(
      page.getByText("We've received your application for Example role (fixture)."),
    ).toBeVisible();
    await expect(page.getByText("Example hiring process (fixture).")).toBeVisible();
    // What happens next, without promising an email (candidate emails are off).
    await expect(page.getByRole("heading", { name: "What happens next" })).toBeVisible();
    await expect(
      page.getByText(
        "We assess every application on the skills, experience and potential it shows for the role.",
      ),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/confirmation email|we will email you/i);
    // Focus moves to the success message.
    await expect(page.locator(":focus")).toContainText("Application received.");
  });

  test("can be completed with the keyboard alone", async ({ page }) => {
    await page.goto(ROLE);
    // The file picker is the browser's own dialog: choose the file programmatically. Its name
    // appears once the form has hydrated, so nothing typed below is lost to hydration.
    await page.locator('input[type="file"]').setInputFiles(pdf());
    await expect(page.getByText("example-cv.pdf, 2 KB")).toBeVisible();
    await page.getByLabel("Full name").focus();
    await page.keyboard.type("Example Applicant");
    await page.keyboard.press("Tab");
    await page.keyboard.type("applicant@example.test");
    await page.getByLabel("Yes", { exact: true }).focus();
    await page.keyboard.press("Space");
    await page.getByRole("checkbox").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "candidate privacy notice" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Send application" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Application received." })).toBeVisible();
  });

  test("lists errors, links them to their fields and focuses the first", async ({ page }) => {
    await page.goto(ROLE);
    await page.getByRole("button", { name: "Send application" }).click();
    const summary = page.locator("main").getByRole("alert");
    await expect(summary).toContainText("There is a problem");
    for (const message of [
      "Enter your name",
      "Enter a valid email address",
      "Upload your CV as a PDF or Word document",
      "Choose an answer",
      "Tick the box to agree to the candidate privacy notice",
    ]) {
      await expect(summary.getByRole("link", { name: message })).toBeVisible();
    }
    await expect(page.getByLabel("Full name")).toBeFocused();
    await expect(page.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
    const describedBy = await page.getByLabel("Full name").getAttribute("aria-describedby");
    // The shared Field's error line: a visually hidden "Error:" and the message.
    await expect(page.locator(`#${describedBy}`)).toHaveText("Error: Enter your name");
  });

  test("checks an answer when you leave the field and clears the error once fixed", async ({
    page,
  }) => {
    await page.goto(ROLE);
    const email = page.getByLabel("Email");
    // Tabbing through an empty required field says nothing yet.
    await page.getByLabel("Full name").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Full name")).not.toHaveAttribute("aria-invalid", "true");
    await email.fill("not-an-address");
    await email.blur();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = await email.getAttribute("aria-describedby");
    await expect(page.locator(`#${describedBy}`)).toHaveText("Error: Enter a valid email address");
    await email.fill("applicant@example.test");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a valid email address")).toHaveCount(0);
  });

  test("refuses an oversize or wrong-type CV before uploading", async ({ page }) => {
    await page.goto(ROLE);
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ ...pdf(10 * 1024 * 1024 + 1) });
    await expect(page.getByText("Your CV must be 10 MB or smaller")).toBeVisible();
    await input.setInputFiles({
      name: "example.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("MZ"),
    });
    await expect(page.getByText("Upload your CV as a PDF or Word document").first()).toBeVisible();
  });

  test("says so when the role closed after the page loaded", async ({ page, request }) => {
    await page.goto("/careers/example-role-closing");
    await request.get(`${ADMIN}/__roles?close=example-role-closing`);
    try {
      await fillValid(page);
      await page.getByRole("button", { name: "Send application" }).click();
      await expect(page.locator("main").getByRole("alert")).toContainText(
        "This role is no longer accepting applications.",
      );
    } finally {
      await request.get(`${ADMIN}/__roles?open=example-role-closing`);
    }
  });
});
