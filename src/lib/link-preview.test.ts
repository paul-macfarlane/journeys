import { describe, expect, it } from "vitest";

import { APP_NAME, APP_TAGLINE, BRAND_COLORS } from "@/lib/brand";

import {
  journeyLinkMetadata,
  LINK_PREVIEW_DESCRIPTION_LIMIT,
  linkPreviewPalette,
  projectLinkMetadata,
} from "./link-preview";

describe("linkPreviewPalette", () => {
  it("paints the default preset in the app's own colours", () => {
    expect(linkPreviewPalette({ preset: "trail", accent: null })).toEqual({
      background: BRAND_COLORS.chalk,
      foreground: BRAND_COLORS.ink,
      muted: BRAND_COLORS.moss,
      primary: BRAND_COLORS.spruce,
      onPrimary: BRAND_COLORS.paper,
    });
  });

  it("paints a preset in that preset's light-scheme tokens", () => {
    // Tide's `--background`, `--foreground`, `--muted-foreground`,
    // `--primary`, and `--primary-foreground` from globals.css, converted
    // with the maths in scripts/contrast.mjs.
    expect(linkPreviewPalette({ preset: "tide", accent: null })).toEqual({
      background: "#eef9fa",
      foreground: "#0f222b",
      muted: "#3c5b65",
      primary: "#005b60",
      onPrimary: "#f3fcfd",
    });
  });

  it("lets an accent stand in for the primary, with text that reads on it", () => {
    const palette = linkPreviewPalette({ preset: "slate", accent: "#ffcc00" });

    expect(palette.primary).toBe("#ffcc00");
    // A bright accent takes the dark text `accentForeground` chooses.
    expect(palette.onPrimary).toBe("#111111");
    expect(palette.background).toBe("#f5f7f9");
  });
});

describe("journeyLinkMetadata", () => {
  const live = {
    kind: "live" as const,
    title: "Border Crossing",
    description: "Goal: cross the border.",
  };

  it("describes a live Journey as a Participant sees it", () => {
    expect(journeyLinkMetadata(live, "abc")).toEqual({
      title: "Border Crossing",
      description: "Goal: cross the border.",
      openGraph: {
        type: "article",
        url: "/j/abc",
        siteName: APP_NAME,
        title: "Border Crossing",
        description: "Goal: cross the border.",
      },
      twitter: {
        card: "summary_large_image",
        title: "Border Crossing",
        description: "Goal: cross the border.",
      },
    });
  });

  it("cuts a long description to the link-preview limit", () => {
    const long = "word ".repeat(60).trim();
    const metadata = journeyLinkMetadata({ ...live, description: long }, "abc");

    expect(LINK_PREVIEW_DESCRIPTION_LIMIT).toBe(160);
    expect(metadata.description).toBe(`${long.slice(0, 160)}…`);
    expect(metadata.openGraph?.description).toBe(metadata.description);
  });

  it("gives a Journey with no description none", () => {
    const metadata = journeyLinkMetadata({ ...live, description: "  " }, "abc");

    expect(metadata.description).toBeUndefined();
    expect(metadata.openGraph?.description).toBeUndefined();
    expect(metadata.twitter?.description).toBeUndefined();
  });

  it("answers an unavailable or unknown Journey with the app's own metadata", () => {
    const generic = {
      title: { absolute: APP_NAME },
      description: APP_TAGLINE,
      openGraph: {
        type: "website",
        siteName: APP_NAME,
        title: APP_NAME,
        description: APP_TAGLINE,
      },
      twitter: {
        card: "summary_large_image",
        title: APP_NAME,
        description: APP_TAGLINE,
      },
    };

    expect(journeyLinkMetadata({ kind: "unavailable" }, "abc")).toEqual(
      generic,
    );
    expect(journeyLinkMetadata(null, "abc")).toEqual(generic);
  });
});

describe("projectLinkMetadata", () => {
  it("describes a Project by its title and the opening of its rich text", () => {
    expect(
      projectLinkMetadata(
        {
          title: "Refugee Health",
          description: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "About these journeys" }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "Three cases." }],
              },
            ],
          },
        },
        "p1",
      ),
    ).toEqual({
      title: "Refugee Health",
      description: "About these journeys Three cases.",
      openGraph: {
        type: "website",
        url: "/p/p1",
        siteName: APP_NAME,
        title: "Refugee Health",
        description: "About these journeys Three cases.",
      },
      twitter: {
        card: "summary_large_image",
        title: "Refugee Health",
        description: "About these journeys Three cases.",
      },
    });
  });

  it("gives a Project with a blank description none", () => {
    const metadata = projectLinkMetadata(
      { title: "Refugee Health", description: { type: "doc", content: [] } },
      "p1",
    );

    expect(metadata.description).toBeUndefined();
    expect(metadata.openGraph?.description).toBeUndefined();
  });

  it("answers an unknown Project with the app's own metadata", () => {
    expect(projectLinkMetadata(null, "p1").title).toEqual({
      absolute: APP_NAME,
    });
  });
});
