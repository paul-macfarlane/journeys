import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { resolveMetadataBase } from "@/lib/metadata-base";

/**
 * `lastModified`, read once when this module is first imported, so every
 * entry — and every rebuild of the sitemap within the same running build —
 * carries the moment the build happened rather than the moment each
 * request was served.
 */
const BUILT_AT = new Date();

// Must match those pages' own `alternates.canonical` by hand — a path added
// here without one, or changed there without a matching edit here, is a
// page the sitemap and the page itself disagree about.
const INDEXABLE_PATHS = ["/", "/about", "/guide", "/privacy", "/terms"];

/**
 * Every page it is worth a search engine indexing (ticket 42): the five
 * static, prose pages that carry `alternates.canonical` — `/`, `/about`,
 * `/guide`, `/privacy`, `/terms`. Nothing under `/j`, `/p`, or `/authors`:
 * those are `noindex` and discovered only by the link an Author hands out,
 * never by a crawler walking the sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveMetadataBase(env);
  return INDEXABLE_PATHS.map((path) => ({
    url: new URL(path, base).toString(),
    lastModified: BUILT_AT,
  }));
}
