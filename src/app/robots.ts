import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { resolveMetadataBase } from "@/lib/metadata-base";

/**
 * Served at `/robots.txt` (ticket 42). Everything is allowed except
 * `/sign-in`, the Author-only `/projects` tree, and `/api`, which is what
 * every `noindex` metadata elsewhere in the app backs up: a crawler is
 * told the same thing twice, once here and once per page, so one of the
 * two staying right is not the only thing keeping an Author's own pages out
 * of a search index.
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
