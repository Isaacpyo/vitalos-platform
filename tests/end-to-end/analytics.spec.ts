import { expect, test } from "@playwright/test";
import { PERSONAL_DATA, recordAnalytics, recordedEvents } from "../support/analytics";

/**
 * Analytics events fire with the provider stubbed (C1, ADR-046). The listeners are delegated, so
 * these run against the real pages. Careers application events are covered in tests/content,
 * which has the fake Super Admin.
 */
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one viewport is enough for event wiring");
  await recordAnalytics(page);
});

test("a click on the header's Talk to Vitalos records cta_click with label and page", async ({
  page,
}) => {
  await page.goto("/what-we-do");
  // Stay on the page so the recorded event can be read (the listener runs before navigation).
  await page.evaluate(() =>
    document.addEventListener("click", (event) => event.preventDefault(), { once: true }),
  );
  await page.getByRole("banner").getByRole("link", { name: "Talk to Vitalos" }).first().click();
  expect(await recordedEvents(page)).toContainEqual({
    name: "cta_click",
    properties: { label: "talk-to-vitalos", page: "/what-we-do" },
  });
});

test("a link to another site records outbound_click with its host only", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "https://www.example.com/some/path?ref=campaign";
    link.textContent = "Example outbound link";
    document.querySelector("main")?.append(link);
  });
  await page.getByRole("link", { name: "Example outbound link" }).click();
  expect(await recordedEvents(page)).toContainEqual({
    name: "outbound_click",
    properties: { host: "www.example.com", page: "/" },
  });
});

test("the enquiry form records enquiry_started once, and the receipt records enquiry_sent", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.getByLabel("Name").fill("Example Visitor");
  await page.getByLabel("Organisation").fill("Example Organisation");
  const started = (await recordedEvents(page)).filter((e) => e.name === "enquiry_started");
  expect(started).toEqual([{ name: "enquiry_started", properties: { page: "/contact" } }]);

  await page.goto("/contact/thank-you");
  await expect
    .poll(async () => recordedEvents(page))
    .toContainEqual({ name: "enquiry_sent", properties: { page: "/contact" } });
});

test("Relay's vitalos:relay events become relay_opened, relay_question and relay_handoff", async ({
  page,
}) => {
  await page.goto("/faq");
  await page.evaluate(() => {
    for (const type of ["opened", "question", "handoff", "unknown"]) {
      window.dispatchEvent(new CustomEvent("vitalos:relay", { detail: { type } }));
    }
  });
  const names = (await recordedEvents(page)).map((e) => e.name);
  expect(names).toEqual(["relay_opened", "relay_question", "relay_handoff"]);
  for (const event of await recordedEvents(page)) {
    expect(event.properties).toEqual({ page: "/faq" });
  }
});

test("no event carries personal data or a query string", async ({ page }) => {
  await page.goto("/contact?intent=example&utm_source=example");
  await page.getByLabel("Name").fill("Example Applicant");
  await page.getByLabel("Work email").fill("applicant@example.test");
  const events = await recordedEvents(page);
  expect(events.length).toBeGreaterThan(0);
  expect(JSON.stringify(events)).not.toMatch(PERSONAL_DATA);
});
