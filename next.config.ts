import type { NextConfig } from "next";

// Cache Components (Next 16 PPR) stays off in Foundation: every page here is
// auth-aware and renders dynamically. Turning it on is a deliberate later
// decision, taken with the caching strategy for public participant pages.
const nextConfig: NextConfig = {
  // The site footer's copyright year is the build's, inlined here so every
  // page — static or dynamic — shows the same one (`src/lib/brand.ts`).
  env: { BUILD_YEAR: String(new Date().getFullYear()) },
  // Metadata is resolved before the page is sent, for every visitor, rather
  // than streamed in after it (Next 16's default for anything but the bots
  // it lists). Streamed, a client navigation can commit the new page before
  // its metadata arrives, and the head sits with no `<title>` and no meta
  // tags in between: a Journey page's tab switch (`UrlTabs`, a
  // `router.replace`) was caught by axe on CI with an empty title for 0.6s.
  // Every `generateMetadata` here is a `cache()`d read the page makes
  // anyway, so waiting for it costs the first byte next to nothing.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
