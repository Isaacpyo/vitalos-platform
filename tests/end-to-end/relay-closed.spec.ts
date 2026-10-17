import { expect, test } from "@playwright/test";

/**
 * C2 (fixed by WS6, verified by WS5): while Relay is closed, its panel is not in the document,
 * or is `inert` and hidden from assistive technology, and holds no `<article>` or conversation
 * log. Hovering or focusing the launcher may preload the panel's code but must not mount it.
 * Expected to fail until the WS6 widget change is merged into the integration branch.
 */
test("C2 (fixed by WS6): a closed Relay has no panel, article or log in the DOM", async ({
  page,
}) => {
  await page.goto("/");
  const launcher = page.getByRole("button", { name: /Open chat with Relay/ });
  await expect(launcher).toBeVisible();
  await launcher.hover();
  await launcher.focus();
  // Give the lazily loaded panel module time to arrive and render if it would.
  await page.waitForLoadState("networkidle");

  const report = await page.evaluate(() => {
    const root = document.querySelector(".relay-root");
    const panel = document.getElementById("relay-panel");
    const exposed = panel !== null && !panel.closest("[inert]") && panel.getAttribute("aria-hidden") !== "true";
    return {
      articles: root?.querySelectorAll("article").length ?? 0,
      logs: root?.querySelectorAll('[role="log"]').length ?? 0,
      exposed,
    };
  });
  expect(report).toEqual({ articles: 0, logs: 0, exposed: false });
});
