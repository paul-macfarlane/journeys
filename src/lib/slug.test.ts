import { describe, expect, it } from "vitest";

import { slugify, slugSchema, uniqueSlug } from "@/lib/slug";

// A fake `isTaken` backed by a literal set of slugs, standing in for the
// unique index. The database is a system boundary; nothing here mocks our
// own modules.
function takenSlugs(...slugs: string[]) {
  const taken = new Set(slugs);
  return (slug: string) => taken.has(slug);
}

describe("slugify", () => {
  it("turns a Project title into a lowercase hyphenated slug", () => {
    expect(slugify("Refugee Health Pathways")).toBe("refugee-health-pathways");
  });

  it("strips diacritics rather than dropping the letters", () => {
    expect(slugify("Café Naïve Über")).toBe("cafe-naive-uber");
  });

  it("collapses punctuation and runs of whitespace into single hyphens", () => {
    expect(slugify("  Hello,   World! (2026)  ")).toBe("hello-world-2026");
  });

  it("leaves an already-slugged title unchanged", () => {
    expect(slugify("already-slugged-123")).toBe("already-slugged-123");
  });

  it("falls back to untitled for an empty title", () => {
    expect(slugify("")).toBe("untitled");
  });

  it("falls back to untitled when no alphanumerics survive", () => {
    expect(slugify("!!! ???")).toBe("untitled");
  });

  it("caps the slug at 60 characters", () => {
    expect(slugify("a".repeat(70))).toBe("a".repeat(60));
  });

  it("never leaves a trailing hyphen after capping", () => {
    // 59 "a"s, then " bc": the 60th character would be the hyphen.
    expect(slugify(`${"a".repeat(59)} bc`)).toBe("a".repeat(59));
  });
});

describe("slugSchema", () => {
  it("accepts a well-formed slug", () => {
    expect(slugSchema.safeParse("refugee-health").success).toBe(true);
  });

  it.each([
    ["an empty slug", ""],
    ["uppercase letters", "Refugee-Health"],
    ["a space", "refugee health"],
    ["a leading hyphen", "-refugee-health"],
    ["a trailing hyphen", "refugee-health-"],
    ["doubled hyphens", "refugee--health"],
    ["more than 60 characters", "a".repeat(61)],
  ])("rejects %s", (_label, value) => {
    expect(slugSchema.safeParse(value).success).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when nothing has taken it", async () => {
    await expect(uniqueSlug("refugee-health", takenSlugs())).resolves.toBe(
      "refugee-health",
    );
  });

  it("appends -2 when the base slug is taken", async () => {
    await expect(
      uniqueSlug("refugee-health", takenSlugs("refugee-health")),
    ).resolves.toBe("refugee-health-2");
  });

  it("appends -3 when the base slug and -2 are both taken", async () => {
    await expect(
      uniqueSlug(
        "refugee-health",
        takenSlugs("refugee-health", "refugee-health-2"),
      ),
    ).resolves.toBe("refugee-health-3");
  });

  it("awaits an asynchronous isTaken", async () => {
    const taken = takenSlugs("refugee-health");

    await expect(
      uniqueSlug("refugee-health", async (slug) => taken(slug)),
    ).resolves.toBe("refugee-health-2");
  });

  it("keeps the suffixed slug within 60 characters", async () => {
    const base = "a".repeat(60);

    await expect(uniqueSlug(base, takenSlugs(base))).resolves.toBe(
      `${"a".repeat(58)}-2`,
    );
  });
});
