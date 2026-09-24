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
  // Never retried, anywhere: a test that passes on its second attempt is a
  // flaky test, and a flaky test is fixed at its cause or deleted
  // (docs/agents/testing.md). Retries would only hide which one it is.
  retries: 0,
  reporter: "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // The production server over the build `pnpm test:e2e` makes first (CI
    // reuses the build its own step already made), never `next dev`. A dev
    // server compiles each route on its first request and ships the editor's
    // bundle slowly on a small machine, so a click on the Journey page could
    // land before React had loaded and a navigation could wait on Turbopack:
    // every flaky e2e run this repository has had was one of those two. The
    // built app is also what ships, and it logs no development-only notices
    // into the evidence.
    command: `pnpm exec next start -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    // A listener already on the e2e port is a leftover from an earlier run
    // (possibly on another branch) — silently testing against that instead
    // of a fresh server is worse than failing to bind, and it would also
    // never reuse a `pnpm dev` running on port 3000.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      // Overridden rather than inherited from `.env.local`/CI so this server
      // points at the dedicated e2e database (never the dev one) and so
      // better-auth's origin check passes for requests arriving on
      // `E2E_PORT` instead of the app's usual port.
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: E2E_BASE_URL,
      // Blank whatever the developer's own environment holds (ticket 43):
      // the app's env parser reads an empty value as absent, so a deciding
      // Prompt always falls back to its Choices here, the suite proves that
      // fallback, and no run of it ever calls the AI Gateway or spends a
      // token.
      AI_GATEWAY_API_KEY: "",
    },
  },
});
