import { notFound, redirect } from "next/navigation";

import { RunnerFrame } from "@/components/runner/runner-frame";
import {
  previewDecision,
  ResponseNotice,
  responseRefusal,
  StepView,
} from "@/components/runner/step-view";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { getProjectForMember } from "@/db/projects";
import { requireSession } from "@/lib/session";
import { effectiveTheme } from "@/lib/theme";

import { previewChooseAction } from "./actions";

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
    decide?: string | string[];
    confidence?: string | string[];
    response?: string | string[];
  }>;
}) {
  const session = await requireSession();
  const [{ projectId, journeyId }, { notice, decide, confidence, response }] =
    await Promise.all([params, searchParams]);

  const journey = await getJourneyForMember(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!journey) notFound();

  const stored = await getDraftForMember(projectId, journeyId, session.user.id);
  if (!stored) notFound();
  // A Draft that cannot be read has nothing to preview: the Journey page
  // says so and offers a Restore (ticket 73).
  if (stored.kind === "unreadable") {
    redirect(`/projects/${projectId}/journeys/${journeyId}`);
  }
  const draft = stored.document;

  // Preview paints the Theme a Participant will see (the Journey's
  // override, else the Project's), so an Author sees the look along with
  // the words. The Project read is the request-cached one the layout made.
  const project = await getProjectForMember(projectId, session.user.id);
  if (!project) notFound();
  const theme = effectiveTheme(project.theme, journey.theme);

  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  // Own property only: a Start pointer naming "toString" would otherwise
  // find a prototype method and render a 500.
  const hasStart = Object.hasOwn(draft.steps, draft.startStepId);

  return (
    <RunnerFrame
      title={journey.title}
      description={journey.description || undefined}
      preview={{ editorHref: journeyHref }}
      // The way out (ticket 69), pointed at Preview's own routes: the
      // Author's Project page. No header "Start over" here: this is the
      // start, as on the live runner's first screen.
      project={{ title: project.title, href: `/projects/${projectId}` }}
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
                    // Preview stores nothing, so a deciding Prompt's
                    // Response travels back in the address (ticket 43) —
                    // but only once the judge has actually been asked
                    // (`decide` present); a bare `?response=` on its own is
                    // never trusted back into the box (ticket 43 F6).
                    response:
                      typeof decide === "string" && typeof response === "string"
                        ? response
                        : undefined,
                    decision: previewDecision(
                      draft.steps[draft.startStepId],
                      decide,
                      confidence,
                    ),
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
