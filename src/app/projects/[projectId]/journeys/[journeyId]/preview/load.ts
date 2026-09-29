// Server-only data loading — `server-only` so a client import fails the build.
import "server-only";

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { journeyForMember, type MemberJourney } from "@/db/access";
import { getDraft } from "@/db/drafts";
import { hasStep, type GraphDocument } from "@/lib/graph/document";
import { requireSession } from "@/lib/session";
import { effectiveTheme, type Theme } from "@/lib/theme";

/**
 * The Journey, resolved for the signed-in Member — a non-Member and an
 * unknown Journey both 404 — and its Draft as stored. Read once per request:
 * `requireSession` and `journeyForMember` are `cache()`d already, and so is
 * this, so a screen's `generateMetadata` and the screen itself share one
 * Draft read.
 */
const loadStored = cache(async (projectId: string, journeyId: string) => {
  const session = await requireSession();

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) notFound();

  return { journey, stored: await getDraft(journey) };
});

/**
 * What both Preview screens start from (ticket 82): the Journey, resolved
 * for the signed-in Member — a non-Member and an unknown Journey both 404 —
 * its Draft, the Theme a Participant will see (the Journey's override, else
 * its Project's), so an Author sees the look along with the words, and the
 * Journey page's address. A Draft that cannot be read has nothing to
 * preview: the Journey page says so and offers a Restore (ticket 73), so
 * this sends the Author there.
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
  const { journey, stored } = await loadStored(projectId, journeyId);

  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  if (!stored) notFound();
  if (stored.kind === "unreadable") redirect(journeyHref);

  return {
    journey,
    draft: stored.document,
    theme: effectiveTheme(journey.project.theme, journey.theme),
    journeyHref,
  };
}

/**
 * Both Preview screens' tab title (ticket 91): "Preview: <Journey title>",
 * with the root layout's template appending "· Journeys". Everything the
 * screen itself 404s on 404s here too — a non-Member, an unknown Journey, a
 * missing Draft, and on a Step screen (`stepId`) a Step the Draft does not
 * have — since metadata streams in after the page (ticket 60's trap), and a
 * title returned here would replace the not-found page's own. An unreadable
 * Draft keeps the title: the screen sends the Author to the Journey page.
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
  const { journey, stored } = await loadStored(projectId, journeyId);
  if (!stored) notFound();
  if (
    stepId !== undefined &&
    stored.kind !== "unreadable" &&
    !hasStep(stored.document, stepId)
  ) {
    notFound();
  }

  return { title: `Preview: ${journey.title}` };
}
