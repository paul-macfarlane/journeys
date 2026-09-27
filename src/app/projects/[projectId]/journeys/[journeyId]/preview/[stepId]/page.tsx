import { notFound } from "next/navigation";

import { RunnerFrame } from "@/components/runner/runner-frame";
import {
  choiceLinkClassName,
  ResponseNotice,
  responseRefusal,
  StepView,
} from "@/components/runner/step-view";
import { hasStep, isEnding } from "@/lib/graph/document";

import { previewChooseAction } from "../actions";
import { loadPreview } from "../load";

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
  searchParams: Promise<{
    notice?: string | string[];
  }>;
}) {
  const [{ projectId, journeyId, stepId }, { notice }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { journey, draft, theme, journeyHref } = await loadPreview({
    projectId,
    journeyId,
  });

  if (!hasStep(draft, stepId)) notFound();
  const step = draft.steps[stepId];

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
      // The way out (ticket 69), pointed at Preview's own routes: the
      // Author's Project page, and the first screen wherever the Step does
      // not offer "Start over" itself — an Ending does, below its Outcome.
      project={{ title: journey.project.title, href: `/projects/${projectId}` }}
      startOver={
        isEnding(step) ? undefined : { href: `${journeyHref}/preview` }
      }
      theme={theme}
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
                refusal: responseRefusal(notice),
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
