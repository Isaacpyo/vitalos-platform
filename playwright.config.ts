import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright harness (ADR-021). The suites run against a PRODUCTION build (`next build` then
 * `next start`), never `next dev`, so they exercise the same output as a deployment.
 *
 * Environment for the server under test is parametrised so it can switch as the Stage 1
 * workstreams land. Defaults describe the target harness:
 *
 *   E2E_CONTENT_SOURCE   fixtures | empty   (default fixtures; artificial content, rejected in
 *                                            production by @vitalos/config)
 *   E2E_FIXTURE_SET      full | sparse      (default full)
 *   E2E_ENQUIRY_BACKEND  memory | disabled  (default memory; rejected in production)
 *   E2E_PORT             port for the app   (default 3210, so a developer's `next dev` on 3000 is
 *                                            never reused or clobbered)
 *   E2E_REUSE_SERVER=1   reuse a server already listening on E2E_PORT (local iteration only)
 *   E2E_SKIP_BUILD=1     start without rebuilding (only when .next is known to be current)
 *   E2E_SPARSE_BASE_URL  base URL of a server started with VITALOS_FIXTURE_SET=sparse; enables the
 *                        `sparse` project (see below). Implied when E2E_FIXTURE_SET=sparse.
 *
 * Projects (ADR-021):
 *   chromium / mobile    every browser spec against the `full` fixture set (desktop and 390px)
 *   no-js                *.nojs.spec.ts with JavaScript disabled
 *   http                 *.http.spec.ts: protocol checks over HTTP only (headers, redirects,
 *                        robots, sitemap, abuse, link crawl), no browser, so they run once
 *   sparse               *.sparse.spec.ts against a build with the `sparse` fixture set. Gated
 *                        routes are decided at build time and a second build would overwrite
 *                        `.next`, so the sparse run is its own invocation: with
 *                        E2E_FIXTURE_SET=sparse this config builds the sparse server and defines
 *                        ONLY the sparse project (`pnpm test:e2e:sparse`; its own CI job).
 *
 * The fixtures content source and the memory enquiry backend are delivered by other workstreams
 * (C2, D). Until they are wired into the app, the environment variables are accepted by
 * @vitalos/config and ignored by the app, which renders its locked-copy shell. Nothing here needs
 * to change when they land.
 *
 * Turnstile uses Cloudflare's documented dummy keys (always-passing visible widget and secret):
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */

const port = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${port}`;

export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const web = "corepack pnpm --filter @vitalos/web exec next";
const command = [
  process.env.E2E_SKIP_BUILD === "1" ? undefined : `${web} build`,
  `${web} start --hostname 127.0.0.1 --port ${port}`,
]
  .filter(Boolean)
  .join(" && ");

const nojs = /.*\.nojs\.spec\.ts$/;
const sparse = /.*\.sparse\.spec\.ts$/;
const http = /.*\.http\.spec\.ts$/;

const fixtureSet = process.env.E2E_FIXTURE_SET ?? "full";
const sparseRun = fixtureSet === "sparse";
const sparseBaseUrl = process.env.E2E_SPARSE_BASE_URL ?? (sparseRun ? baseURL : undefined);

// Files named *.sparse.spec.ts assert behaviour below the publication gates. They need a server
// built with VITALOS_FIXTURE_SET=sparse (see the header comment). Inert unless one is configured.
const sparseProject = {
  name: "sparse",
  testMatch: sparse,
  use: { ...devices["Desktop Chrome"], baseURL: sparseBaseUrl ?? baseURL },
  metadata: { requires: "E2E_SPARSE_BASE_URL or E2E_FIXTURE_SET=sparse" },
  grep: sparseBaseUrl ? undefined : /^(?!)/,
};

export default defineConfig({
  testDir: "./tests",
  // Storybook and unit suites have their own runners; Playwright owns the browser suites only.
  testIgnore: ["**/storybook/**", "**/integration/**"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  webServer: {
    command,
    url: `${baseURL}/api/health`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
    stdout: "pipe",
    env: {
      NEXT_PUBLIC_SITE_URL: baseURL,
      VITALOS_DEPLOY_ENV: "local",
      VITALOS_CONTENT_SOURCE: process.env.E2E_CONTENT_SOURCE ?? "fixtures",
      VITALOS_FIXTURE_SET: fixtureSet,
      VITALOS_ENQUIRY_BACKEND: process.env.E2E_ENQUIRY_BACKEND ?? "memory",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
      TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
      // Test-only values for secrets the pipeline requires; they protect nothing.
      ENQUIRY_IP_HASH_SALT: "e2e-only-ip-hash-salt-not-a-secret",
      OUTBOX_DISPATCH_SECRET: "e2e-only-outbox-dispatch-secret-not-a-secret",
      EMAIL_PROVIDER: "none",
    },
  },
  use: { baseURL, trace: "retain-on-failure" },
  projects: sparseRun
    ? [sparseProject]
    : [
        {
          name: "chromium",
          testIgnore: [nojs, sparse, http],
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "mobile",
          testIgnore: [nojs, sparse, http],
          use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
        },
        {
          // Progressive-enhancement checks: files named *.nojs.spec.ts run with JavaScript disabled.
          name: "no-js",
          testMatch: nojs,
          use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
        },
        {
          // Protocol checks over HTTP (APIRequestContext only): the result does not depend on a
          // viewport, so each runs once instead of once per browser project.
          name: "http",
          testMatch: http,
        },
        sparseProject,
      ],
});
