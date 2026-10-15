import { defineConfig, devices } from "@playwright/test";
import { ADMIN_URL, CONTROL_URL, WEB_PORT, WEB_URL, adminEnv, webEnv } from "./support/env.mjs";

/**
 * Two-app content suites (brief section 13): the REAL Super Admin (Django on SQLite, seeded with
 * obviously fictional fixtures) and a production build of the website, talking over signed HTTP
 * exactly as in production (ADR-039, ADR-040). Not in CI: it needs the Super Admin's Python
 * virtualenv. Run from the repo root:
 *
 *   corepack pnpm exec playwright test -c tests/content-sync/playwright.config.ts
 *
 * Specs run in file order on one worker, because they share one admin database and one website
 * cache: 1-sync (publish, changes, slug, unpublish, schedule, target down, preview),
 * 2-availability (admin down drill) and 3-careers. Timings are written to
 * test-results/content-sync/timings.json. The build overwrites apps/web/.next.
 */
const web = "corepack pnpm --filter @vitalos/web exec next";

export default defineConfig({
  testDir: ".",
  testMatch: /\d-.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10 * 60_000,
  reporter: [["list"]],
  outputDir: "../../test-results/content-sync/artifacts",
  webServer: [
    {
      command: "node tests/content-sync/support/proxies.mjs",
      url: `${CONTROL_URL}/state`,
      cwd: "../..",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "node tests/content-sync/support/start-admin.mjs",
      url: `${ADMIN_URL}/login/`,
      cwd: "../..",
      reuseExistingServer: false,
      timeout: 180_000,
      env: adminEnv,
    },
    {
      command: [
        process.env.E2E_SKIP_BUILD === "1" ? undefined : `${web} build`,
        `${web} start --hostname 127.0.0.1 --port ${WEB_PORT}`,
      ]
        .filter(Boolean)
        .join(" && "),
      url: `${WEB_URL}/api/health`,
      cwd: "../..",
      reuseExistingServer: false,
      timeout: 600_000,
      env: webEnv,
    },
  ],
  use: { baseURL: WEB_URL, locale: "en-GB", timezoneId: "Europe/London", reducedMotion: "reduce" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
