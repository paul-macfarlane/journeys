import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/prose-page";
import { PLAY_JOURNEY_HREF, PLAY_JOURNEY_LABEL } from "@/lib/demo";

// The layout's template appends "· Journeys", so the title is the bare
// phrase. This segment's metadata replaces the page's own when a page calls
// `notFound()`, which is what gives `/p/<unknown>` and `/nope` one title.
export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * The one not-found page (ticket 60): a route that exists nowhere and every
 * page answering an unknown id with `notFound()` render this inside the
 * prose shell, so a Participant who follows a stale or mistyped link gets
 * the header, a `main` landmark, a way home, and the footer instead of the
 * framework's bare screen. Written for a Participant: no ids, no routes,
 * nothing about why the link went stale.
 */
export default function NotFound() {
  return (
    <ProsePage title="Page not found">
      <p>
        There is nothing at this address. A Journey or a Project is found only
        by the link its Authors hand out.
      </p>
      <p>
        <Link href="/">Go to the front page</Link>
      </p>
      <p>
        <Link href={PLAY_JOURNEY_HREF}>{PLAY_JOURNEY_LABEL}</Link>
      </p>
    </ProsePage>
  );
}
