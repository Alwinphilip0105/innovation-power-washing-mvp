import { defineConfig, devices } from "@playwright/test";

/**
 * Tests the built static export, served as a dumb file host.
 *
 * Separate from playwright.config.ts because it runs against ./out rather than
 * a dev server: the point is to prove the export needs no server at all, which
 * a Next process running in the background would quietly hide.
 *
 * Build it first — `npm run test:static` does both.
 */
export default defineConfig({
  testDir: "./tests/static",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://localhost:4321/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
