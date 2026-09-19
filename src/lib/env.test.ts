import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env";

// A complete, valid environment for an Author running the app locally.
// NODE_ENV is deliberately absent so the default is exercised.
const validEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5436/journeys",
  // Built at runtime so no secret-shaped literal sits in the source.
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  DISCORD_CLIENT_ID: "discord-client-id",
  DISCORD_CLIENT_SECRET: "discord-client-secret",
};

describe("parseEnv", () => {
  it("accepts a complete environment and defaults NODE_ENV to development", () => {
    const parsed = parseEnv(validEnv);

    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5436/journeys",
    );
    expect(parsed.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(parsed.DISCORD_CLIENT_SECRET).toBe("discord-client-secret");
  });

  it("keeps ANTHROPIC_API_KEY optional", () => {
    expect(parseEnv(validEnv).ANTHROPIC_API_KEY).toBeUndefined();
  });

  // .env.example tells an Author to leave the key empty to hide the AI
  // features, so a blank value has to mean "absent", not "invalid".
  it("treats an empty ANTHROPIC_API_KEY as absent", () => {
    expect(
      parseEnv({ ...validEnv, ANTHROPIC_API_KEY: "" }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
  });

  it("rejects a missing BETTER_AUTH_SECRET and names the field", () => {
    const withoutSecret = { ...validEnv, BETTER_AUTH_SECRET: undefined };

    expect(() => parseEnv(withoutSecret)).toThrowError(/BETTER_AUTH_SECRET/);
  });

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", () => {
    expect(() =>
      parseEnv({ ...validEnv, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrowError(/BETTER_AUTH_SECRET/);
  });

  it("rejects a DATABASE_URL that is not a postgres connection string", () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        DATABASE_URL: "mysql://localhost:3306/journeys",
      }),
    ).toThrowError(/DATABASE_URL/);
  });
});
