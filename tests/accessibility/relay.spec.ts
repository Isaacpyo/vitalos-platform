import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";
import { ask, openRelay } from "../support/relay";

// Vitalos Relay: WCAG 2.2 AA (axe) on every panel state, in the desktop and 390px projects.

test("launcher has no axe violations and does not cause horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expectNoA11yViolations(page, { include: [".relay-root"] });
  await expectNoHorizontalOverflowAt320(page);
});

test("welcome state has no axe violations", async ({ page }) => {
  await page.goto("/");
  await openRelay(page);
  await expectNoA11yViolations(page, { include: ["#relay-panel"] });
});

test("answer with sources and feedback has no axe violations", async ({ page }) => {
  test.slow(); // streams an answer, then a full-panel axe scan
  await page.goto("/");
  await openRelay(page);
  await ask(page, "Can you rescue a failing software project?");
  await expectNoA11yViolations(page, { include: ["#relay-panel"] });
});

test("thumbs-down reasons and the returning-visitor choice have no axe violations", async ({
  page,
  context,
}) => {
  test.slow();
  await page.goto("/");
  await openRelay(page);
  await ask(page, "Can you rescue a failing software project?");
  await page.locator(".relay-answer").last().getByRole("button", { name: "Not helpful" }).click();
  await expect(page.getByText("What went wrong?")).toBeVisible();
  await expectNoA11yViolations(page, { include: ["#relay-panel"] });
  const next = await context.newPage();
  await next.goto("/");
  await openRelay(next, { expectWelcome: false });
  await expect(next.getByRole("button", { name: "Continue previous conversation" })).toBeVisible();
  await expectNoA11yViolations(next, { include: ["#relay-panel"] });
  await next.close();
});

test("hand-off card, with and without errors, has no axe violations", async ({ page }) => {
  await page.goto("/");
  await openRelay(page);
  await page.getByRole("button", { name: "Talk to a person" }).first().click();
  await expectNoA11yViolations(page, { include: ["#relay-panel"] });
  await page.getByRole("button", { name: "Connect me to a person" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expectNoA11yViolations(page, { include: ["#relay-panel"] });
});

test("reduced motion: the panel opens without sliding", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await openRelay(page);
  const animation = await page
    .locator("#relay-panel")
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe("relay-fade-in");
  await context.close();
});

test("200% zoom: the panel stays usable without horizontal scrolling", async ({ page }) => {
  // 200% zoom on a 1280x800 screen is a 640x400 CSS viewport (WCAG 1.4.4 and 1.4.10).
  await page.setViewportSize({ width: 640, height: 400 });
  await page.goto("/");
  await openRelay(page);
  const overflow = await page
    .locator("#relay-panel")
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const composer = page.getByLabel("Message Relay");
  await expect(composer).toBeVisible();
  await expect(composer).toBeInViewport();
});
