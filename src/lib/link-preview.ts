import type { Metadata } from "next";

import { APP_NAME, APP_TAGLINE, BRAND_COLORS } from "@/lib/brand";
import { contentPreview, textPreview, type Content } from "@/lib/graph/content";
import { accentForeground, type Theme, type ThemePreset } from "@/lib/theme";

/**
 * Link previews (ticket 37): what a chat or a social card shows for a
 * Journey or a Project link — the page metadata and the colours the Open
 * Graph image is painted in. Pure and database-free: the pages'
 * `generateMetadata` and the `opengraph-image` routes hand their public
 * answers in, so a unit test can read the same metadata a crawler does.
 *
 * A preview shows what a Participant would see and nothing more (Paul,
 * 2026-09-22): the live Published Version's title and description, the
 * Project's title and description, the app mark. A Journey that is unknown,
 * never published, or unpublished gets the app's own metadata, so a preview
 * reveals nothing a Participant is not shown.
 */

/** How much of a description a link preview gets, as the Project page cut it. */
export const LINK_PREVIEW_DESCRIPTION_LIMIT = 160;

/** The five colours an Open Graph image is painted in. */
export type LinkPreviewPalette = {
  /** The paper: `--background`. */
  background: string;
  /** Body text: `--foreground`. */
  foreground: string;
  /** The description: `--muted-foreground`. */
  muted: string;
  /** The stripe and the mark's tile: `--primary`, or the accent. */
  primary: string;
  /** The fork on the tile: `--primary-foreground`, or what reads on the accent. */
  onPrimary: string;
};

/**
 * Each preset's light-scheme tokens as sRGB hex, because the image renderer
 * reads no stylesheet. The `trail` row is the brand palette itself; the
 * rest are the `[data-theme]` blocks in `globals.css` converted with the
 * same maths as `scripts/contrast.mjs`, so a preset edited there is edited
 * here too. Light only: a link preview has no scheme to follow.
 */
const PRESET_PALETTES: Record<ThemePreset, LinkPreviewPalette> = {
  trail: {
    background: BRAND_COLORS.chalk,
    foreground: BRAND_COLORS.ink,
    muted: BRAND_COLORS.moss,
    primary: BRAND_COLORS.spruce,
    onPrimary: BRAND_COLORS.paper,
  },
  parchment: {
    background: "#faf3e5",
    foreground: "#372414",
    muted: "#6c5644",
    primary: "#9e4421",
    onPrimary: "#fdfaf3",
  },
  tide: {
    background: "#eef9fa",
    foreground: "#0f222b",
    muted: "#3c5b65",
    primary: "#005b60",
    onPrimary: "#f3fcfd",
  },
  dusk: {
    background: "#f6f3fc",
    foreground: "#271d2e",
    muted: "#60516b",
    primary: "#763584",
    onPrimary: "#fbf9ff",
  },
  ember: {
    background: "#faf4ef",
    foreground: "#2a1e1a",
    muted: "#67534a",
    primary: "#a53e00",
    onPrimary: "#fff9f4",
  },
  slate: {
    background: "#f5f7f9",
    foreground: "#171b22",
    muted: "#4f5661",
    primary: "#1e4eac",
    onPrimary: "#f8fafd",
  },
};

/**
 * The colours a Theme paints an image in: the preset's tokens, with an
 * accent standing in for the primary exactly as `themeStyle` maps it onto
 * the runner frame, and the text that reads on it chosen the same way.
 */
export function linkPreviewPalette(theme: Theme): LinkPreviewPalette {
  const preset = PRESET_PALETTES[theme.preset];
  if (theme.accent === null) return preset;
  return {
    ...preset,
    primary: theme.accent,
    onPrimary: accentForeground(theme.accent),
  };
}

/** The `Metadata` fields a titled, described page carries for a link. */
function linkMetadata({
  title,
  description,
  type,
  url,
}: {
  title: string;
  description: string;
  type: "article" | "website";
  url: string;
}): Metadata {
  // Absent rather than empty: an empty og:description is a blank line on
  // the card, where absence lets the card show nothing.
  const cut = description.length > 0 ? description : undefined;
  return {
    title,
    description: cut,
    openGraph: { type, url, siteName: APP_NAME, title, description: cut },
    twitter: { card: "summary_large_image", title, description: cut },
  };
}

/**
 * The app's own metadata, which the root layout also declares: what a page
 * with nothing public to say carries, so an unknown or unavailable Journey
 * reads exactly like the site root. The title is absolute so the layout's
 * template does not make it "Journeys · Journeys".
 */
function genericLinkMetadata(): Metadata {
  return {
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
}

/**
 * What a Journey link previews as: the live Published Version's title and
 * description for a live Journey, the app's own metadata otherwise. The
 * shape is the public answer's, structurally, so the runner's
 * `getPublicJourney` result is passed straight in.
 */
export function journeyLinkMetadata(
  journey:
    | { kind: "live"; title: string; description: string }
    | { kind: "unavailable" }
    | null,
  journeyId: string,
): Metadata {
  if (!journey || journey.kind !== "live") return genericLinkMetadata();
  return linkMetadata({
    title: journey.title,
    description: textPreview(
      journey.description,
      LINK_PREVIEW_DESCRIPTION_LIMIT,
    ),
    type: "article",
    url: `/j/${journeyId}`,
  });
}

/**
 * What a Project link previews as: its title and the opening of its
 * rich-text description, cut as the public Project page always cut it;
 * the app's own metadata for an unknown id.
 */
export function projectLinkMetadata(
  project: { title: string; description: Content } | null,
  projectId: string,
): Metadata {
  if (!project) return genericLinkMetadata();
  return linkMetadata({
    title: project.title,
    description: contentPreview(
      project.description,
      LINK_PREVIEW_DESCRIPTION_LIMIT,
    ),
    type: "website",
    url: `/p/${projectId}`,
  });
}
