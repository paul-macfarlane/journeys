import { defineConfig, devices } from "@playwright/test";

import { E2E_BASE_URL, E2E_PORT, loadE2eEnv } from "./e2e/setup/e2e-env";

// Resolved at config load (before `globalSetup` runs) because `webServer.env`
// below has to carry the same database URL global setup migrates and the
// specs' session helper opens its own connection to.
const { databaseUrl } = loadE2eEnv();

export default defineConfig({
  testDir: "./e2e",
  // Creates and migrates the dedicated e2e database before `webServer`
  // starts Next against it, so a fresh clone needs no bootstrap step.
  globalSetup: "./e2e/setup/global-setup.ts",
  outputDir: "test-results/playwright",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    // A listener already on the e2e port is a leftover from an earlier run
    // (possibly on another branch) — silently testing against that instead
    // of a fresh server is worse than failing to bind, and it would also
    // never reuse a `pnpm dev` running on port 3000.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Overridden rather than inherited from `.env.local`/CI so this server
      // points at the dedicated e2e database (never the dev one) and so
      // better-auth's origin check passes for requests arriving on
      // `E2E_PORT` instead of the app's usual port.
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: E2E_BASE_URL,
    },
  },
});
