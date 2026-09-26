import { afterEach, describe, expect, it, vi } from "vitest";

import {
  participantCookieOptions,
  runCookieName,
  runCookieOptions,
  runCookiePath,
} from "@/lib/run-cookies";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runCookieName", () => {
  it("names the cookie after the Journey it belongs to", () => {
    expect(runCookieName("abc123")).toBe("journeys.run.abc123");
  });
});

describe("runCookiePath", () => {
  it("scopes the path to that one Journey", () => {
    expect(runCookiePath("abc123")).toBe("/j/abc123");
  });
});

describe("participantCookieOptions", () => {
  it("is scoped to /j, not to one Journey", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(participantCookieOptions().path).toBe("/j");
  });

  it("is always httpOnly", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(participantCookieOptions().httpOnly).toBe(true);
  });

  it("is secure only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(participantCookieOptions().secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(participantCookieOptions().secure).toBe(false);
  });
});

describe("runCookieOptions", () => {
  it("scopes the path to /j/<journeyId>", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(runCookieOptions("abc123").path).toBe("/j/abc123");
  });

  it("is always httpOnly", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(runCookieOptions("abc123").httpOnly).toBe(true);
  });

  it("is secure only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(runCookieOptions("abc123").secure).toBe(true);

    vi.stubEnv("NODE_ENV", "test");
    expect(runCookieOptions("abc123").secure).toBe(false);
  });
});
