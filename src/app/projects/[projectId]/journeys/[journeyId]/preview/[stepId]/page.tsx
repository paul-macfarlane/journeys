import { notFound } from "next/navigation";

import { RunnerFrame } from "@/components/runner/runner-frame";
import {
  choiceLinkClassName,
  ResponseNotice,
  StepView,
} from "@/components/runner/step-view";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { requireSession } from "@/lib/session";

import { previewChooseAction } from "../actions";

/**
 * Preview's per-Step screen: one Step of the Draft, walked exactly the way a
 * Participant would walk it, in the participant runner's own frame, but
 * recording nothing. A Step with a Prompt offers its textbox and posts to
 * Preview's own action, which reads the answer by the runner's rule and
 * stores none of it; `notice` carries that action's one-line answer back.
 * Member-only, same as every other Journey page — a non-Member and an
 * unknown Step both 404.
 */
export default async function PreviewStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; journeyId: string; stepId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const session = await requireSession();
  const [{ projectId, journeyId, stepId }, { notice }] = await Promise.all([
    params,
    searchParams,
  ]);

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

  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  return (
    <RunnerFrame
      title={journey.title}
      // The description belongs to the Start Step alone, as in the runner.
      description={
        stepId === draft.startStepId
          ? journey.description || undefined
          : undefined
      }
      preview={{ editorHref: journeyHref }}
    >
      <ResponseNotice notice={notice} />

      <StepView
        step={step}
        document={draft}
        choices={
          step.prompt !== null
            ? {
                kind: "form",
                action: previewChooseAction.bind(
                  null,
                  projectId,
                  journeyId,
                  stepId,
                ),
              }
            : {
                kind: "links",
                href: (targetStepId) =>
                  `${journeyHref}/preview/${targetStepId}`,
              }
        }
        // Preview records nothing, so starting over is just a link back to
        // its first screen — the runner posts a server action here instead,
        // because starting over there drops the Run cookie.
        startOver={
          <a href={`${journeyHref}/preview`} className={choiceLinkClassName}>
            Start over
          </a>
        }
      />
    </RunnerFrame>
  );
}
