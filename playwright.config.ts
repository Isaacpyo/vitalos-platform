import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  webServer: {
    command: "pnpm dev:web",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
});
