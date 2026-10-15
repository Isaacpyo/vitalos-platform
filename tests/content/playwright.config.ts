import { defineConfig, devices } from "@playwright/test";

/**
 * Insights (and later Careers) suites against a fake Super Admin (ADR-039, ADR-040). NOT wired
 * into CI yet: run by hand with
 *
 *   corepack pnpm exec playwright test -c tests/content/playwright.config.ts
 *
 * It builds and starts the website with the content API configured (the fake admin serves the
 * shared contract fixtures and verifies every request with scheme v1), on its own ports, so it
 * never reuses a server from the main e2e config. The build overwrites apps/web/.next.
 *
 *   CONTENT_E2E_PORT        website port (default 3220)
 *   CONTENT_E2E_ADMIN_PORT  fake admin port (default 8799)
 *   E2E_SKIP_BUILD=1        start without rebuilding
 *
 * Screenshots (insights.visual.spec.ts) are keyed by platform; regenerate with
 * `--update-snapshots`. The site has no dark theme yet, so the dark captures document that.
 */
const port = Number(process.env.CONTENT_E2E_PORT ?? 3220);
const adminPort = Number(process.env.CONTENT_E2E_ADMIN_PORT ?? 8799);
const baseURL = `http://127.0.0.1:${port}`;
const web = "corepack pnpm --filter @vitalos/web exec next";

const contentEnv = {
  NEXT_PUBLIC_SITE_URL: baseURL,
  VITALOS_DEPLOY_ENV: "local",
  VITALOS_CONTENT_SOURCE: "fixtures",
  VITALOS_ENQUIRY_BACKEND: "memory",
  ENQUIRY_IP_HASH_SALT: "e2e-only-ip-hash-salt-not-a-secret",
  EMAIL_PROVIDER: "none",
  // Test-only values; they protect nothing (tests/content/support/fake-admin.mjs).
  CONTENT_API_BASE_URL: `http://127.0.0.1:${adminPort}`,
  CONTENT_READ_KEY_ID: "e2e-read",
  CONTENT_READ_SECRET: "e2e-read-secret-not-a-secret-000000000000",
  CONTENT_PREVIEW_SECRET: "e2e-preview:e2e-preview-secret-not-a-secret-00000000",
  CONTENT_REVALIDATE_SECRET: "e2e-revalidate:e2e-revalidate-secret-not-a-secret-000",
  CONTENT_RENDER_SECRET: "e2e-render:e2e-render-secret-not-a-secret-000000000",
  CONTENT_MEDIA_HOST: "https://media.example.test",
  CAREERS_SUBMIT_KEY_ID: "e2e-submit",
  CAREERS_SUBMIT_SECRET: "e2e-submit-secret-not-a-secret-0000000000",
  // The fake admin is also the CV upload target (the A9 fallback).
  CAREERS_UPLOAD_HOST: `http://127.0.0.1:${adminPort}`,
  // No Turnstile keys: the check is off outside production, so the form flow is deterministic.
};

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../../test-results/content",
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.005,
      threshold: 0.2,
    },
  },
  webServer: [
    {
      command: `node tests/content/support/fake-admin.mjs --port ${adminPort} --web-origin ${baseURL}`,
      url: `http://127.0.0.1:${adminPort}/__hits`,
      cwd: "../..",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: [
        process.env.E2E_SKIP_BUILD === "1" ? undefined : `${web} build`,
        `${web} start --hostname 127.0.0.1 --port ${port}`,
      ]
        .filter(Boolean)
        .join(" && "),
      url: `${baseURL}/api/health`,
      cwd: "../..",
      reuseExistingServer: false,
      timeout: 300_000,
      env: contentEnv,
    },
  ],
  use: { baseURL, locale: "en-GB", timezoneId: "UTC", reducedMotion: "reduce" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
