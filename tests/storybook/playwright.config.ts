import { defineConfig, devices } from "@playwright/test";

/**
 * Storybook accessibility harness (ADR-021). Serves the static build (`pnpm storybook:build`)
 * with a tiny dependency-free server and runs axe against every story in index.json.
 *
 *   E2E_STORYBOOK_PORT   default 6317
 */
const port = Number(process.env.E2E_STORYBOOK_PORT ?? 6317);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "../../playwright-report", open: "never" }]]
    : [["list"]],
  outputDir: "../../test-results",
  webServer: {
    command: `node tests/support/static-server.mjs apps/storybook/storybook-static ${port}`,
    // Executed from the repository root (cwd of the Playwright process).
    cwd: "../..",
    url: `${baseURL}/index.json`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "storybook", use: { ...devices["Desktop Chrome"] } }],
});
