import Link from "next/link";
import { notFound } from "next/navigation";

import { PreviewChrome } from "@/components/journeys/preview-chrome";
import { buttonVariants } from "@/components/ui/button";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Preview's start screen: the Journey as a participant would first see it,
 * with a "Begin" link into the Start Step. Member-only, same as every other
 * Journey page — a non-Member and an unknown Journey both 404.
 */
export default async function PreviewStartPage({
  params,
}: {
  params: Promise<{ projectId: string; journeyId: string }>;
}) {
  const session = await requireSession();
  const { projectId, journeyId } = await params;

  const journey = await getJourneyForMember(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!journey) notFound();

  const draft = await getDraftForMember(projectId, journeyId, session.user.id);
  if (!draft) notFound();

  // Own property only: a Start pointer naming "toString" would otherwise
  // find a prototype method and offer a Begin link into a 500.
  const canBegin = Object.hasOwn(draft.steps, draft.startStepId);

  return (
    <PreviewChrome projectId={projectId} journeyId={journeyId}>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {journey.title}
        </h1>
        {journey.description ? (
          <p className="text-muted-foreground">{journey.description}</p>
        ) : null}

        {canBegin ? (
          <Link
            href={`/projects/${projectId}/journeys/${journeyId}/preview/${draft.startStepId}`}
            className={cn(buttonVariants({ size: "lg" }), "self-start")}
          >
            Begin
          </Link>
        ) : (
          <p className="text-muted-foreground">This draft has no start step.</p>
        )}
      </div>
    </PreviewChrome>
  );
}
