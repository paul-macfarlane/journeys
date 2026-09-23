import { ImageResponse } from "next/og";

import { APP_NAME, APP_TAGLINE, BRAND_COLORS } from "@/lib/brand";

// Served at /opengraph-image and linked as og:image from every page. Built
// once at build time; nothing here reads a request.
export const alt = `${APP_NAME} — ${APP_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The display face for the name, fetched from Google Fonts at build time.
 * `next/font` keeps its downloads for the page bundle only, and committing
 * a font file would mean carrying its licence text too. If the fetch fails
 * the image still builds, in the renderer's default face, so an outage at
 * Google never fails a build; `docs/branding.md` notes the trade.
 */
async function loadLiterata(): Promise<ArrayBuffer | null> {
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

export default async function OpenGraphImage() {
  const literata = await loadLiterata();

  return new ImageResponse(
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
      <svg width="168" height="168" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill={BRAND_COLORS.spruce} />
        <g
          fill="none"
          stroke={BRAND_COLORS.paper}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 27.5V17.5c0-4.5-7.5-5-7.5-9.5" />
          <path d="M16 17.5c0-6.5 7.5-6.5 7.5-13" />
        </g>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontFamily: literata ? "Literata" : "serif",
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
    </div>,
    {
      ...size,
      fonts: literata
        ? [{ name: "Literata", data: literata, weight: 600, style: "normal" }]
        : undefined,
    },
  );
}
