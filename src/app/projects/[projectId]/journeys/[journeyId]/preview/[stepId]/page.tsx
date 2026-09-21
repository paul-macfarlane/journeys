import { notFound } from "next/navigation";

import { PreviewFrame } from "@/components/journeys/preview-frame";
import { StepView } from "@/components/runner/step-view";
import { buttonVariants } from "@/components/ui/button";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Preview's per-Step screen: one Step of the Draft, walked exactly the way a
 * participant would walk it, but recording nothing. Member-only, same as
 * every other Journey page — a non-Member and an unknown Step both 404.
 */
export default async function PreviewStepPage({
  params,
}: {
  params: Promise<{ projectId: string; journeyId: string; stepId: string }>;
}) {
  const session = await requireSession();
  const { projectId, journeyId, stepId } = await params;

  const journey = await getJourneyForMember(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!journey) notFound();

  const draft = await getDraftForMember(projectId, journeyId, session.user.id);
  if (!draft) notFound();

  // Own property only: `steps` is a plain object parsed from JSON, and a
  // URL naming "toString" must 404 rather than find a prototype method.
  if (!Object.hasOwn(draft.steps, stepId)) notFound();
  const step = draft.steps[stepId];

  return (
    <PreviewFrame projectId={projectId} journeyId={journeyId}>
      <StepView
        step={step}
        document={draft}
        stepHref={(targetStepId) =>
          `/projects/${projectId}/journeys/${journeyId}/preview/${targetStepId}`
        }
        // Preview records nothing, so starting over is just a link back to
        // its start screen — the runner posts a server action here instead,
        // because starting over there creates a Run.
        startOver={
          <a
            href={`/projects/${projectId}/journeys/${journeyId}/preview`}
            className={cn(buttonVariants({ variant: "outline" }), "self-start")}
          >
            Start over
          </a>
        }
      />
    </PreviewFrame>
  );
}
