import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { BrandCard, OG_CONTENT_TYPE, OG_SIZE, ogResponse } from "@/lib/og";

// Served at /opengraph-image and linked as og:image from every page that
// has no card of its own. Built once at build time; nothing here reads a
// request. The card itself lives in `src/lib/og.tsx`, where the Journey
// and Project cards share its face and its mark.
export const alt = `${APP_NAME} — ${APP_TAGLINE}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return ogResponse(<BrandCard />);
}
