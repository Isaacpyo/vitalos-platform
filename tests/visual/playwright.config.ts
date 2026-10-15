import { defineConfig, devices } from "@playwright/test";
import base from "../../playwright.config";

/**
 * Visual-regression harness (ADR-021 decision 7). NON-GATING: it is not part of `pnpm check` or
 * `pnpm test:e2e`, and its CI job is `continue-on-error`. It becomes a gate only after the owner
 * approves the Figma templates. See tests/visual/README.md.
 *
 * Serves the same production build as the e2e config (the web server is reused from it, so the
 * fixtures content source, memory enquiry backend and dummy Turnstile keys are identical) and
 * screenshots the 26 templates at 1440 and 390 CSS px under the `full` fixture set.
 *
 * Baselines are keyed by `{platform}` and project, because font rasterisation and Chromium
 * version differ between environments and a baseline from one never matches another.
 *
 *   E2E_PORT   port for the app (default 3210), as in the e2e config
 */
/**
 * Baseline set label. CI sets VISUAL_BASELINE_SET=ci; anything run by hand is `local`. Both are
 * `linux`, so `{platform}` alone would let a developer container baseline shadow the CI one.
 */
const baselineSet = process.env.VISUAL_BASELINE_SET ?? "local";
const webServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "../../playwright-report", open: "never" }]]
    : [["list"]],
  outputDir: "../../test-results",
  snapshotPathTemplate: `{testDir}/__screenshots__/{platform}-${baselineSet}/{projectName}/{arg}{ext}`,
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      // Tolerates sub-pixel anti-aliasing; a moved block or changed colour exceeds it.
      maxDiffPixelRatio: 0.005,
      threshold: 0.2,
    },
  },
  // Relay is off for the visual baselines (they predate it; the launcher is covered by the
  // Relay specs and their own screenshots).
  webServer: webServer && {
    ...webServer,
    cwd: "../..",
    env: { ...webServer.env, RELAY_ENABLED: "false" },
  },
  use: {
    baseURL: `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 3210)}`,
    reducedMotion: "reduce",
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "UTC",
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
});
