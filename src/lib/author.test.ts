import { describe, expect, it } from "vitest";

import {
  AUTHOR_LINK_KINDS,
  authorBioSchema,
  authorLinkLabel,
  authorLinksSchema,
  authorLinkUrlSchema,
  authorNameSchema,
  readAuthorLinks,
} from "./author";

describe("authorNameSchema", () => {
  it("trims and accepts a name between 1 and 60 characters", () => {
    expect(authorNameSchema.parse("  Jane Doe  ")).toBe("Jane Doe");
    expect(authorNameSchema.parse("a")).toBe("a");
    expect(authorNameSchema.parse("a".repeat(60))).toBe("a".repeat(60));
  });

  it("refuses blank, whitespace-only, and over-long names", () => {
    expect(authorNameSchema.safeParse("").success).toBe(false);
    expect(authorNameSchema.safeParse("   ").success).toBe(false);
    expect(authorNameSchema.safeParse("a".repeat(61)).success).toBe(false);
  });
});

describe("authorBioSchema", () => {
  it("accepts a blank bio", () => {
    expect(authorBioSchema.parse("")).toBe("");
  });

  it("keeps an inner line break, trimming only the ends", () => {
    expect(authorBioSchema.parse("  line one\nline two  ")).toBe(
      "line one\nline two",
    );
  });

  it("refuses a bio over 1000 characters", () => {
    expect(authorBioSchema.safeParse("a".repeat(1001)).success).toBe(false);
    expect(authorBioSchema.safeParse("a".repeat(1000)).success).toBe(true);
  });
});

describe("authorLinkUrlSchema", () => {
  it("accepts a linkedin.com or www.linkedin.com https link", () => {
    expect(
      authorLinkUrlSchema("linkedin").safeParse("https://www.linkedin.com/in/x")
        .success,
    ).toBe(true);
    expect(
      authorLinkUrlSchema("linkedin").safeParse("https://linkedin.com/in/x")
        .success,
    ).toBe(true);
  });

  it("refuses http, the wrong platform, a lookalike host, and garbage", () => {
    expect(
      authorLinkUrlSchema("linkedin").safeParse("http://linkedin.com/in/x")
        .success,
    ).toBe(false);
    expect(
      authorLinkUrlSchema("linkedin").safeParse("https://github.com/x").success,
    ).toBe(false);
    expect(
      authorLinkUrlSchema("linkedin").safeParse(
        "https://linkedin.com.evil.example/x",
      ).success,
    ).toBe(false);
    expect(authorLinkUrlSchema("linkedin").safeParse("not a url").success).toBe(
      false,
    );
  });

  it("accepts any https host for website and refuses http", () => {
    expect(
      authorLinkUrlSchema("website").safeParse("https://example.com").success,
    ).toBe(true);
    expect(
      authorLinkUrlSchema("website").safeParse("https://anything.example")
        .success,
    ).toBe(true);
    expect(
      authorLinkUrlSchema("website").safeParse("http://example.com").success,
    ).toBe(false);
  });
});

describe("authorLinksSchema", () => {
  it("refuses two entries of the same kind with 'One link per kind'", () => {
    const result = authorLinksSchema.safeParse([
      { kind: "github", url: "https://github.com/a" },
      { kind: "github", url: "https://github.com/b" },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "One link per kind"),
      ).toBe(true);
    }
  });

  it("refuses six entries", () => {
    const sixWebsites = Array.from({ length: 6 }, (_, i) => ({
      kind: "website" as const,
      url: `https://example${i}.com`,
    }));
    const result = authorLinksSchema.safeParse(sixWebsites);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message === "Use five links or fewer",
        ),
      ).toBe(true);
    }
  });

  it("accepts five distinct kinds", () => {
    const links = AUTHOR_LINK_KINDS.map((entry) => ({
      kind: entry.kind,
      url:
        entry.host === null
          ? "https://example.com"
          : `https://www.${entry.host}/x`,
    }));
    const result = authorLinksSchema.safeParse(links);
    expect(result.success).toBe(true);
  });
});

describe("readAuthorLinks", () => {
  it("returns [] for null, a string, and an array with a bad entry", () => {
    expect(readAuthorLinks(null)).toEqual([]);
    expect(readAuthorLinks("nope")).toEqual([]);
    expect(
      readAuthorLinks([{ kind: "github", url: "https://example.com" }]),
    ).toEqual([]);
  });

  it("returns the array for a good value", () => {
    const good = [{ kind: "github", url: "https://github.com/x" }];
    expect(readAuthorLinks(good)).toEqual(good);
  });
});

describe("authorLinkLabel", () => {
  it("labels every kind", () => {
    expect(authorLinkLabel("linkedin")).toBe("LinkedIn");
    expect(authorLinkLabel("website")).toBe("Website");
  });
});
