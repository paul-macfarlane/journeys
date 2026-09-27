import { RunnerFrame } from "@/components/runner/runner-frame";
import {
  ResponseNotice,
  responseRefusal,
  StepView,
} from "@/components/runner/step-view";
import { hasStep } from "@/lib/graph/document";

import { previewChooseAction } from "./actions";
import { loadPreview } from "./load";

/**
 * Preview's first screen: the Draft's Start Step, exactly as a Participant
 * first sees a live Journey (ticket 27) — the same frame, the Journey's
 * title in its header, the description beneath it — with a banner saying
 * this is Preview and a way back to the editor. Choices are plain links into
 * the Draft's Steps, and no Run exists. A Start with a Prompt offers it the
 * way the live Start would — as a form, posting to Preview's own action,
 * which records nothing. Member-only, same as every other Journey page — a
 * non-Member and an unknown Journey both 404.
 */
export default async function PreviewStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; journeyId: string }>;
  searchParams: Promise<{
    notice?: string | string[];
  }>;
}) {
  const [{ projectId, journeyId }, { notice }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { journey, draft, theme, journeyHref } = await loadPreview({
    projectId,
    journeyId,
  });

  const hasStart = hasStep(draft, draft.startStepId);

  return (
    <RunnerFrame
      title={journey.title}
      description={journey.description || undefined}
      preview={{ editorHref: journeyHref }}
      // The way out (ticket 69), pointed at Preview's own routes: the
      // Author's Project page. No header "Start over" here: this is the
      // start, as on the live runner's first screen.
      project={{ title: journey.project.title, href: `/projects/${projectId}` }}
      theme={theme}
    >
      {hasStart ? (
        <>
          <ResponseNotice notice={notice} />
          {/* No "Start over" on an Ending here: this is the start. The live
              Start offers no Prompt while it is an Ending either, so neither
              does this one — links, then, exactly as the runner chooses. */}
          <StepView
            step={draft.steps[draft.startStepId]}
            document={draft}
            choices={
              draft.steps[draft.startStepId].prompt !== null &&
              draft.steps[draft.startStepId].choices.length > 0
                ? {
                    kind: "form",
                    action: previewChooseAction.bind(
                      null,
                      projectId,
                      journeyId,
                      draft.startStepId,
                    ),
                    refusal: responseRefusal(notice),
                  }
                : {
                    kind: "links",
                    href: (stepId) => `${journeyHref}/preview/${stepId}`,
                  }
            }
            startOver={null}
          />
        </>
      ) : (
        <p className="text-muted-foreground">This draft has no start step.</p>
      )}
    </RunnerFrame>
  );
}
