import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { resolveMetadataBase } from "@/lib/metadata-base";

// Rendered per request, like every page whose metadata these URLs must
// agree with. Left static, Next would bake them at build time from the
// build's own environment, and a build served elsewhere (CI builds for one
// origin and serves on another; a Vercel build is promoted between
// deployments) would name an origin the pages themselves do not.
export const dynamic = "force-dynamic";

/**
 * Served at `/robots.txt` (ticket 42). Everything is allowed except
 * `/sign-in`, the Author-only `/projects` tree, and `/api`. This disallow
 * guards an obedient crawler that walks the site from here; the per-page
 * `noindex` metadata elsewhere in the app guards a URL a search engine was
 * handed some other way, such as a link shared outside the app, and so
 * never read this file at all. The two answer different fetches, so
 * neither backs the other up for the same one.
 *
 * The link-only public pages — `/j/*`, `/p/*`, `/authors/*` — are not
 * disallowed here: they carry `noindex` themselves (discovery stays
 * link-only), but a crawler that already has a link to one must still be
 * able to fetch it, or a shared link's preview would never resolve either.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/sign-in", "/projects", "/api"],
    },
    sitemap: `${resolveMetadataBase(env).origin}/sitemap.xml`,
  };
}
