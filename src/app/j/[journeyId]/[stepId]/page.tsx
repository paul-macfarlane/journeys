import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { RunHistoryScript } from "@/components/runner/run-history-script";
import { RunHistory } from "@/components/runner/run-history";
import { RunnerFrame } from "@/components/runner/runner-frame";
import {
  choiceLinkClassName,
  liveDecision,
  ResponseNotice,
  responseRefusal,
  StepView,
} from "@/components/runner/step-view";
import { getResponse } from "@/db/responses";
import { getPublicJourney, getRunForJourney, saveRunState } from "@/db/runs";
import { navigateTo, parsePathIndex } from "@/lib/graph/run";
import { journeyLinkMetadata } from "@/lib/link-preview";
import { runCookieName } from "@/lib/run-cookies";

import { respondAndChooseAction, startOverAction } from "../actions";

/**
 * A Step URL pasted into a chat previews as the Journey does (ticket 37):
 * the live version's title and description and the Journey's card, never
 * the Step's own content, and `og:url` names the Journey — which is where
 * anyone but the Participant holding the Run cookie lands.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ journeyId: string; stepId: string }>;
}): Promise<Metadata> {
  const { journeyId } = await params;
  return journeyLinkMetadata(await getPublicJourney(journeyId), journeyId);
}

/**
 * One Step of a Run. Every Step has a URL of its own so the browser's back
 * button walks the Journey the way an in-app Back control does — which is why
 * this page, unusually, writes to the database while it renders: a back
 * navigation is a plain GET, and if it did not record the backtrack here it
 * would not be recorded at all.
 *
 * The Run cookie is the only credential. Without one, or with one naming a
 * Run of some other Journey, there is nothing to resume and the Participant
 * goes to the Start Step at `/j/{journey-id}`. A Run that does resume keeps
 * walking the Published Version it was pinned to, even if the Journey was
 * unpublished mid-walk: only that first screen and a cookie-less step URL
 * answer "unavailable".
 *
 * Two query parameters travel with a navigation and are read here, never
 * kept: `at` is the path index the browser came back to, which is what tells
 * a Back on a loop-closing Step from a Choice to that same Step, and `notice`
 * carries the refusals and confirmations a Participant is told about — the
 * path being full, and since ticket 12 what became of an answer to a Prompt.
 * A deciding Prompt's answer (ticket 43) comes back as `decide`, the
 * judge's pick or "none", and the page offers the Choices with it marked.
 * `RunHistoryScript` and `RunHistory` between them write the index into
 * `history.state` for the next Back, correct a Back the server read as a
 * Choice, and strip both parameters from the address bar.
 *
 * A Step with a Prompt offers its Choices as a form posting to
 * `respondAndChooseAction` rather than as links, so the answer travels with
 * the Choice; the form shows back whatever this Run already answered here.
 */
export default async function RunStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ journeyId: string; stepId: string }>;
  searchParams: Promise<{
    at?: string | string[];
    notice?: string | string[];
    decide?: string | string[];
  }>;
}) {
  const { journeyId, stepId } = await params;
  const { at, notice, decide } = await searchParams;

  const cookieStore = await cookies();
  const runId = cookieStore.get(runCookieName(journeyId))?.value;
  if (!runId) redirect(`/j/${journeyId}`);

  const found = await getRunForJourney(runId, journeyId);
  if (!found) redirect(`/j/${journeyId}`);

  const { run, version, theme } = found;
  const moved = navigateTo(
    version.document,
    run,
    stepId,
    new Date(),
    parsePathIndex(at),
  );

  // Not a Step this Run can reach from where it stands (a typed URL, a stale
  // link, a Choice that is no longer offered): back to where it stands. A
  // Run that has walked as far as a Run may walk is told so when it lands.
  if (moved.kind === "refused") {
    const where = `/j/${journeyId}/${moved.currentStepId}`;
    redirect(
      moved.reason === "path-full" ? `${where}?notice=path-full` : where,
    );
  }
  if (moved.kind === "moved") {
    await saveRunState(run.id, moved.state);
  }

  // The saved path, so Back names the Step actually behind this one.
  const path = moved.kind === "moved" ? moved.state.path : run.path;
  const previousStepId = path.length > 1 ? path[path.length - 2] : null;
  const step = version.document.steps[stepId];

  // Only a Step with a Prompt has anything to show back.
  const response =
    step.prompt !== null ? await getResponse(run.id, stepId) : null;

  // A native button rather than the shared Button, for the same reason as on
  // the first screen: the page stays a Server Component. An Ending offers it
  // below the Outcome; the path-full notice offers it beside the notice,
  // since telling a Participant to start over without a way to is no help.
  // Only one of the two ever renders — a Step that refused a forward move
  // had a Choice to refuse, so it is not an Ending.
  const startOver = (
    <form action={startOverAction.bind(null, journeyId)}>
      <button type="submit" className={choiceLinkClassName}>
        Start over
      </button>
    </form>
  );

  return (
    <RunnerFrame
      title={version.title}
      // The description belongs to the Start Step alone — here, only when a
      // backtrack has brought the Participant all the way back to it.
      description={
        stepId === version.document.startStepId
          ? version.description || undefined
          : undefined
      }
      theme={theme}
    >
      {/* The index this page stands at is remembered while the page is still
          parsing, and a back navigation the server has already read as a
          Choice is corrected there and then; a page restored from the
          browser's cache records nothing at all, and is sent back to the
          server once React is running. */}
      <RunHistoryScript pathIndex={path.length - 1} />
      <RunHistory pathIndex={path.length - 1} />

      {previousStepId ? (
        // The index, not just the Step: on a loop-closing Step the Step
        // behind this one is also a Choice, and a bare URL reads as one.
        <a
          href={`/j/${journeyId}/${previousStepId}?at=${path.length - 2}`}
          className="text-muted-foreground hover:text-foreground self-start text-sm"
        >
          ← Back
        </a>
      ) : null}

      {typeof notice === "string" && notice === "path-full" ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            This journey has gone on too long to continue. Start over to keep
            going.
          </p>
          {startOver}
        </div>
      ) : null}
      <ResponseNotice notice={notice} />

      <StepView
        step={step}
        document={version.document}
        choices={
          step.prompt !== null
            ? {
                kind: "form",
                action: respondAndChooseAction.bind(null, journeyId, stepId),
                response,
                refusal: responseRefusal(notice),
                decision: liveDecision(step, decide),
              }
            : {
                kind: "links",
                href: (targetStepId) => `/j/${journeyId}/${targetStepId}`,
              }
        }
        startOver={startOver}
      />
    </RunnerFrame>
  );
}
