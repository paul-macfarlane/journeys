import type { MetadataRoute } from "next";

import { APP_NAME, APP_TAGLINE, BRAND_COLORS } from "@/lib/brand";

// Served at /manifest.webmanifest and linked from every page by Next's
// metadata file convention. The icons are the same files the browser tab
// uses: the SVG scales to any size, the PNG is the one iOS asks for.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: BRAND_COLORS.chalk,
    theme_color: BRAND_COLORS.spruce,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
