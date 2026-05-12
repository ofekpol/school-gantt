import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    locale: "he-IL",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
