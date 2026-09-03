import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end tests run against a real production build on the in-memory store
 * and mock providers - no credentials, no network, no external services.
 *
 * The dev server is deliberately not used: `next build && next start` is what
 * gets deployed, and prerendering bugs only show up there.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NODE_ENV: "production",
      DATA_STORE: "memory",
      AI_PROVIDER: "mock",
      AUTH_PROVIDER: "dev",
      AUTH_SECRET: "e2e-secret-not-used-in-production",
      APP_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      LOG_LEVEL: "warn",
    },
  },
});
