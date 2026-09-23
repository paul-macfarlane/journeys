import { ImageResponse } from "next/og";

import { APP_NAME, APP_TAGLINE, BRAND_COLORS } from "@/lib/brand";
import { textPreview } from "@/lib/graph/content";
import type { LinkPreviewPalette } from "@/lib/link-preview";

/**
 * The Open Graph images (ticket 37): the brand card the site root has
 * carried since ticket 21, and the themed card a live Journey or a Project
 * gets, drawn by the same renderer from the same face. Pure of the
 * database: the routes under `src/app` read their public data and hand the
 * words and colours in.
 *
 * `ImageResponse` renders JSX through Satori, which reads inline styles
 * only — no stylesheet, no CSS variable, no `oklch()` — so every colour
 * here is sRGB hex from `BRAND_COLORS` or a `LinkPreviewPalette`.
 */

/** The size every card renders at: the Open Graph standard. */
export const OG_SIZE = { width: 1200, height: 630 };

export const OG_CONTENT_TYPE = "image/png";

/**
 * What a request-time card is cached for: long enough that a crawler
 * re-reading a shared link does not render it again, short enough that a
 * rename shows within a publish cycle. Passed explicitly, because
 * `ImageResponse` otherwise marks a card immutable for a year.
 */
export const OG_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=60";

/** How long a title may run before the card cuts it. */
const TITLE_LIMIT = 120;

/** How long the line above the title — a Project's name — may run. */
const KICKER_LIMIT = 80;

/** The face a card's titles are set in: Literata when it loaded, else a serif. */
export type DisplayFace = "Literata" | "serif";

let literata: Promise<ArrayBuffer | null> | null = null;

/**
 * The display face for the name and the titles, fetched from Google Fonts
 * — at build time for the root card, on first request for a Journey's or
 * a Project's, and then kept for the life of the process so no later card
 * fetches it again. `next/font` keeps its downloads for the page bundle
 * only, and committing a font file would mean carrying its licence text
 * too. If the fetch fails the card still renders, in the renderer's
 * default face, so an outage at Google never fails a build or a preview;
 * `docs/branding.md` notes the trade. A failed fetch is not kept, so the
 * next card tries again.
 */
function loadLiterata(): Promise<ArrayBuffer | null> {
  literata ??= fetchLiterata().then((font) => {
    if (font === null) literata = null;
    return font;
  });
  return literata;
}

async function fetchLiterata(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,600&display=swap",
      // An old user agent gets a plain TTF, which the renderer can read;
      // a modern one would get woff2, which it cannot.
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; Journeys OG)" } },
    ).then((response) => response.text());
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    const font = await fetch(url);
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Renders a card at the standard size. The font is loaded once here and
 * the face it gives is handed to the card, so a card never names a face
 * the renderer was not given. `cacheControl` is for the request-time
 * cards; the root card, built once, leaves it unset and takes the
 * renderer's immutable year.
 */
export async function ogResponse(
  card: (face: DisplayFace) => React.ReactElement,
  options: { cacheControl?: string } = {},
): Promise<ImageResponse> {
  const font = await loadLiterata();
  return new ImageResponse(card(font ? "Literata" : "serif"), {
    ...OG_SIZE,
    fonts: font
      ? [{ name: "Literata", data: font, weight: 600, style: "normal" }]
      : undefined,
    headers: options.cacheControl
      ? { "Cache-Control": options.cacheControl }
      : undefined,
  });
}

/** The app mark: the fork on its rounded tile, as `icon.svg` draws it. */
function Mark({
  size,
  tile,
  fork,
}: {
  size: number;
  tile: string;
  fork: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill={tile} />
      <g
        fill="none"
        stroke={fork}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 27.5V17.5c0-4.5-7.5-5-7.5-9.5" />
        <path d="M16 17.5c0-6.5 7.5-6.5 7.5-13" />
      </g>
    </svg>
  );
}

/**
 * The site's own card: the mark, the name, and the tagline on chalk. What
 * the root serves, and what a Journey or Project link falls back to when
 * there is nothing public to show.
 */
export function BrandCard({ face }: { face: DisplayFace }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 88px",
        background: BRAND_COLORS.chalk,
        color: BRAND_COLORS.ink,
      }}
    >
      <Mark size={168} tile={BRAND_COLORS.spruce} fork={BRAND_COLORS.paper} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontFamily: face,
            fontSize: 132,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {APP_NAME}
        </div>
        <div
          style={{
            fontSize: 40,
            lineHeight: 1.3,
            color: BRAND_COLORS.moss,
            maxWidth: 900,
          }}
        >
          {APP_TAGLINE}
        </div>
      </div>
    </div>
  );
}

/** A title's size, stepped down as it runs longer so it still fits. */
function titleSize(title: string): number {
  if (title.length <= 32) return 96;
  if (title.length <= 64) return 76;
  return 58;
}

/**
 * A Journey's or a Project's card, in its Theme's colours as the runner
 * frame paints them: the accent stripe along the top, the mark on its
 * tile beside the kicker (the Project a Journey belongs to; the app for a
 * Project), then the title in the display face and the description in the
 * muted tone. The description arrives already cut to the link-preview
 * limit, the same text the page's `og:description` carries; the title and
 * the kicker are cut here, since the renderer clamps nothing, and a long
 * title steps down in size rather than off the card.
 */
export function LinkPreviewCard({
  face,
  kicker,
  title,
  description,
  palette,
}: {
  face: DisplayFace;
  kicker: string;
  title: string;
  description: string;
  palette: LinkPreviewPalette;
}) {
  const shownTitle = textPreview(title, TITLE_LIMIT);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: palette.background,
        color: palette.foreground,
      }}
    >
      <div style={{ height: 16, background: palette.primary }} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 88px 64px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 32,
            color: palette.muted,
          }}
        >
          <Mark size={56} tile={palette.primary} fork={palette.onPrimary} />
          <span>{textPreview(kicker, KICKER_LIMIT)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontFamily: face,
              fontSize: titleSize(shownTitle),
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {shownTitle}
          </div>
          {description.length > 0 ? (
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.35,
                color: palette.muted,
              }}
            >
              {description}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
