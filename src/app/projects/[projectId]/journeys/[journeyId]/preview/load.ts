// Server-only: it resolves membership and reads the Draft.
import "server-only";

import { notFound, redirect } from "next/navigation";

import { journeyForMember, type MemberJourney } from "@/db/access";
import { getDraft } from "@/db/drafts";
import type { GraphDocument } from "@/lib/graph/document";
import { requireSession } from "@/lib/session";
import { effectiveTheme, type Theme } from "@/lib/theme";

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
  const session = await requireSession();

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) notFound();

  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  const stored = await getDraft(journey);
  if (!stored) notFound();
  if (stored.kind === "unreadable") redirect(journeyHref);

  return {
    journey,
    draft: stored.document,
    theme: effectiveTheme(journey.project.theme, journey.theme),
    journeyHref,
  };
}
