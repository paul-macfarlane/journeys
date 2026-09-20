import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The real package throws outside a React Server context; tests
      // exercise server modules directly.
      "server-only": path.resolve(__dirname, "src/test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // src/lib/env.ts validates process.env at import so a misconfigured
    // deployment fails at boot. These throwaway values just let server
    // modules be imported under test; no test asserts against them, and
    // nothing here is a real credential.
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5436/journeys",
      BETTER_AUTH_SECRET: "vitest-only-secret-not-used-in-any-deployed-env",
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "vitest-dummy",
      GOOGLE_CLIENT_SECRET: "vitest-dummy",
      DISCORD_CLIENT_ID: "vitest-dummy",
      DISCORD_CLIENT_SECRET: "vitest-dummy",
    },
  },
});
