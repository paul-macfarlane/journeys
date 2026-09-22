/**
 * The app's identity as data: what the manifest, the Open Graph image, the
 * legal pages, and the `<meta name="theme-color">` tags all read from, so a
 * rename or a new contact address is one edit. `docs/branding.md` records
 * the direction these values come from.
 *
 * Pure and database-free on purpose: `src/app/manifest.ts` and
 * `src/app/opengraph-image.tsx` run at build time.
 */

export const APP_NAME = "Journeys";

export const APP_TAGLINE =
  "Branching, text-based experiences you can write, publish, and share.";

/** Where a reader of /privacy or /terms writes to. */
export const CONTACT_EMAIL = "pauljosephmacfarlane@gmail.com";

/** The day the legal pages were last changed, shown on both. */
export const LEGAL_UPDATED = "22 September 2026";

/**
 * The palette's anchors as sRGB hex, for the surfaces that cannot read a
 * CSS variable: the favicon, the web manifest, the theme-color meta tags,
 * and the Open Graph image. The oklch sources are in `globals.css`.
 */
export const BRAND_COLORS = {
  /** `--primary` in light mode; the tile behind the mark. */
  spruce: "#095b41",
  /** `--background` in light mode. */
  chalk: "#f8fbf8",
  /** `--background` in dark mode. */
  pineNight: "#0d1914",
  /** `--foreground` in light mode. */
  ink: "#122119",
  /** `--muted-foreground` in light mode. */
  moss: "#475e51",
  /** `--primary-foreground` in light mode; the fork on the tile. */
  paper: "#f6fcf7",
} as const;
