import { notFound } from "next/navigation";

import { RunnerFrame } from "@/components/runner/runner-frame";
import { StepView } from "@/components/runner/step-view";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { requireSession } from "@/lib/session";

/**
 * Preview's first screen: the Draft's Start Step, exactly as a Participant
 * first sees a live Journey (ticket 27) — the same frame, the Journey's
 * title in its header, the description beneath it — with a banner saying
 * this is Preview and a way back to the editor. Choices are plain links into
 * the Draft's Steps, and no Run exists. Member-only, same as every other
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

  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  // Own property only: a Start pointer naming "toString" would otherwise
  // find a prototype method and render a 500.
  const hasStart = Object.hasOwn(draft.steps, draft.startStepId);

  return (
    <RunnerFrame
      title={journey.title}
      description={journey.description || undefined}
      preview={{ editorHref: journeyHref }}
    >
      {hasStart ? (
        // No "Start over" on an Ending here: this is the start.
        <StepView
          step={draft.steps[draft.startStepId]}
          document={draft}
          choices={{
            kind: "links",
            href: (stepId) => `${journeyHref}/preview/${stepId}`,
          }}
          startOver={null}
        />
      ) : (
        <p className="text-muted-foreground">This draft has no start step.</p>
      )}
    </RunnerFrame>
  );
}
