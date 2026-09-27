import { describe, expect, it } from "vitest";

import { resolveMetadataBase } from "./metadata-base";

describe("resolveMetadataBase", () => {
  it("uses BETTER_AUTH_URL locally, where no Vercel env is set", () => {
    expect(
      resolveMetadataBase({ BETTER_AUTH_URL: "http://localhost:3000" }),
    ).toEqual(new URL("http://localhost:3000"));
  });

  it("uses BETTER_AUTH_URL on the production Vercel deployment", () => {
    expect(
      resolveMetadataBase({
        BETTER_AUTH_URL: "https://journeys.example.com",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "journeys.example.com",
      }),
    ).toEqual(new URL("https://journeys.example.com"));
  });

  it("prefers VERCEL_PROJECT_PRODUCTION_URL on a preview deployment that carries one", () => {
    expect(
      resolveMetadataBase({
        BETTER_AUTH_URL: "https://journeys-git-a-branch.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "journeys.example.com",
      }),
    ).toEqual(new URL("https://journeys.example.com"));
  });

  it("falls back to BETTER_AUTH_URL on a preview deployment with no production URL", () => {
    expect(
      resolveMetadataBase({
        BETTER_AUTH_URL: "https://journeys-git-a-branch.vercel.app",
        VERCEL_ENV: "preview",
      }),
    ).toEqual(new URL("https://journeys-git-a-branch.vercel.app"));
  });

  it("falls back to BETTER_AUTH_URL on a preview deployment whose production URL is empty", () => {
    expect(
      resolveMetadataBase({
        BETTER_AUTH_URL: "https://journeys-git-a-branch.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "",
      }),
    ).toEqual(new URL("https://journeys-git-a-branch.vercel.app"));
  });

  it("uses BETTER_AUTH_URL locally in development, even alongside a production URL", () => {
    expect(
      resolveMetadataBase({
        BETTER_AUTH_URL: "http://localhost:3000",
        VERCEL_ENV: "development",
        VERCEL_PROJECT_PRODUCTION_URL: "journeys.example.com",
      }),
    ).toEqual(new URL("http://localhost:3000"));
  });
});
