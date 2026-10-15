import { expect, test } from "@playwright/test";
import { Admin, adminQuery, readSeed, site, until } from "./support/admin";

/**
 * Careers across both real apps (brief Phase 4 "done when"): open a role in the admin and it is
 * on /careers and the homepage within 5 s; apply with a PDF through the real A9 flow (website
 * upload ticket, direct upload to the admin, signed submission) and the admin shows the
 * application, the CV download and an alert; close the role and it leaves the list and the
 * homepage, its page shows the closed state, and its JSON-LD and sitemap entry are gone.
 */
test.describe.configure({ mode: "serial" });

const TARGET_MS = 5_000;
let admin: Admin;
const role = () => readSeed().role;

test.beforeAll(async () => {
  admin = await Admin.signIn();
});

test.afterAll(async () => {
  await admin?.dispose();
});

test("opening a role puts it on /careers and the homepage within 5 s", async () => {
  const { id, slug, title } = role();
  expect((await site(`/careers/${slug}`)).status).toBe(404);
  const at = await admin.roleAction(id, "open");
  // Each surface is timed on its own, so a slow run shows which one lagged.
  const [careersMs, homeMs, pageMs] = await Promise.all([
    until(async () => (await site("/careers")).text.includes(title), at, 30_000),
    until(async () => (await site("/")).text.includes(title), at, 30_000),
    until(
      async () => {
        const page = await site(`/careers/${slug}`);
        return page.status === 200 && page.text.includes('"@type":"JobPosting"');
      },
      at,
      30_000,
    ),
  ]);
  console.log("role open (ms):", JSON.stringify({ careersMs, homeMs, pageMs }));
  const elapsed = Math.max(careersMs, homeMs, pageMs);
  expect(elapsed).toBeLessThanOrEqual(TARGET_MS);
  expect((await site("/sitemap.xml")).text).toContain(`/careers/${slug}<`);
});

test("applying with a PDF: the admin shows the application, the CV download and an alert", async ({
  page,
}) => {
  const { slug, title } = role();
  await page.goto(`/careers/${slug}`);
  await page.getByLabel("Full name", { exact: true }).fill("Example Applicant");
  await page.getByLabel("Email", { exact: true }).fill("applicant@example.test");
  await page.getByLabel("CV", { exact: true }).setInputFiles({
    name: "example-cv.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Example CV (fixture)\n%%EOF\n"),
  });
  await page.getByRole("radio", { name: "Yes" }).check();
  await page
    .getByRole("checkbox", { name: /I agree that Vitalos may process my application/ })
    .check();
  // The Turnstile widget (Cloudflare's always-pass test key) must issue its token first, as it
  // does long before a real applicant finishes the form.
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText("Application received.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(`We've received your application for ${title}.`)).toBeVisible();

  const list = await (await admin.api.get("/careers/applications/")).text();
  expect(list).toContain("Example Applicant");
  const applicationId = /\/careers\/applications\/([0-9a-f-]{36})\//.exec(list)?.[1];
  expect(applicationId, "the list links the application").toBeTruthy();
  const cv = await admin.api.get(`/careers/applications/${applicationId}/cv/`, { maxRedirects: 0 });
  expect([200, 302]).toContain(cv.status());
  if (cv.status() === 200) {
    expect(cv.headers()["content-disposition"] ?? "").toMatch(/^attachment/);
    expect((await cv.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
  const notifications = await (await admin.api.get("/notifications/")).text();
  expect(notifications).toContain("Example Applicant applied for");
  // One internal alert email per role per 10 minutes (EMAIL_TRANSPORT=log here: logged, not sent).
  expect(
    adminQuery(
      "__import__('apps.careers.models', fromlist=['x']).CareersAlertEmail.objects.count()",
    ),
  ).toBe("1");
});

test("closing the role: off the list and homepage, closed page, no JSON-LD or sitemap entry", async () => {
  const { id, slug, title } = role();
  const at = await admin.roleAction(id, "close");
  const checks: Record<string, () => Promise<boolean>> = {
    careersList: async () => !(await site("/careers")).text.includes(title),
    homepage: async () => !(await site("/")).text.includes(title),
    closedPage: async () => {
      const page = await site(`/careers/${slug}`);
      return page.status === 200 && page.text.includes("This role closed on");
    },
    noJsonLd: async () => !(await site(`/careers/${slug}`)).text.includes('"@type":"JobPosting"'),
    sitemap: async () => !(await site("/sitemap.xml")).text.includes(`/careers/${slug}<`),
  };
  const results = await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      try {
        return [name, await until(check, at, 30_000)] as const;
      } catch {
        return [name, Number.POSITIVE_INFINITY] as const;
      }
    }),
  );
  console.log("role close (ms):", JSON.stringify(Object.fromEntries(results)));
  const elapsed = Math.max(...results.map(([, ms]) => ms));
  expect(elapsed).toBeLessThanOrEqual(TARGET_MS);
});
