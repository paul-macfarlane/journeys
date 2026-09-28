// Server-only data loading — `server-only` so a client import fails the build.
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

/**
 * What both Preview screens' `generateMetadata` needs (ticket 91): the
 * Journey, resolved for the signed-in Member the same way `loadPreview`
 * resolves it — `requireSession` and `journeyForMember` are `cache()`d, so
 * this pays no second query once the page itself runs. A non-Member and an
 * unknown Journey both 404 here too (ticket 60's streamed-metadata trap):
 * metadata streams in after the page, so a title returned for a missing
 * Journey would replace the not-found page's own. The Draft is not read
 * here — the title needs only the Journey.
 */
export async function journeyForPreviewMetadata({
  projectId,
  journeyId,
}: {
  projectId: string;
  journeyId: string;
}): Promise<MemberJourney> {
  const session = await requireSession();

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) notFound();

  return journey;
}
