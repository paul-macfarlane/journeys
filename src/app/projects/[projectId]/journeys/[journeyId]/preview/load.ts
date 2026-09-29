// Server-only data loading — `server-only` so a client import fails the build.
import "server-only";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { MemberJourney } from "@/db/access";
import type { GraphDocument } from "@/lib/graph/document";
import type { Theme } from "@/lib/theme";

import {
  loadPreviewSource,
  previewMetadata as loadPreviewMetadata,
} from "./source";

/**
 * What the Draft's Preview screens start from (ticket 82; generalised for
 * ticket 94's D2): the Journey, resolved for the signed-in Member — a
 * non-Member and an unknown Journey both 404 — its Draft, the Theme a
 * Participant will see (the Journey's override, else its Project's), so an
 * Author sees the look along with the words, and the Journey page's
 * address. A Draft that cannot be read has nothing to preview: the Journey
 * page says so and offers a Restore (ticket 73), so `loadPreviewSource`
 * sends the Author there before this ever returns — the `unreadable`
 * branch below is unreachable at runtime and exists only to satisfy the
 * shared result's type, which a Version's Preview does use.
 */
export async function loadPreview({
  projectId,
  journeyId,
}: {
  projectId: string;
  journeyId: string;
}): Promise<{
  journey: MemberJourney;
  draft: GraphDocument;
  theme: Theme;
  journeyHref: string;
}> {
  const result = await loadPreviewSource({
    projectId,
    journeyId,
    source: { kind: "draft" },
  });
  if (result.kind === "unreadable") notFound();

  return {
    journey: result.journey,
    draft: result.document,
    theme: result.theme,
    journeyHref: result.journeyHref,
  };
}

/**
 * Both Draft Preview screens' tab title (ticket 91): "Preview: <Journey
 * title>", with the root layout's template appending "· Journeys".
 * Everything the screen itself 404s on 404s here too — a non-Member, an
 * unknown Journey, a missing Draft, and on a Step screen (`stepId`) a Step
 * the Draft does not have — since metadata streams in after the page
 * (ticket 60's trap). An unreadable Draft keeps the title: the screen sends
 * the Author to the Journey page.
 */
export async function previewMetadata({
  projectId,
  journeyId,
  stepId,
}: {
  projectId: string;
  journeyId: string;
  stepId?: string;
}): Promise<Metadata> {
  return loadPreviewMetadata({
    projectId,
    journeyId,
    source: { kind: "draft" },
    stepId,
  });
}
