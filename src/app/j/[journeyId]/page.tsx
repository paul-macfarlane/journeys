import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { RunnerFrame } from "@/components/runner/runner-frame";
import {
  choiceLinkClassName,
  liveDecision,
  ResponseNotice,
  responseRefusal,
  StepView,
} from "@/components/runner/step-view";
import { getPublicJourney, getRunForJourney } from "@/db/runs";
import { currentStepId } from "@/lib/graph/run";
import { journeyLinkMetadata } from "@/lib/link-preview";
import { runCookieName } from "@/lib/run-cookies";

import { chooseFromStartAction, startOverAction } from "./actions";

/**
 * What a link to this page previews as (ticket 37): the live Published
 * Version's title and description, with the card `opengraph-image.tsx`
 * beside this file renders; a Journey that is not live reads as the site
 * root does. `getPublicJourney` is cached per request, so the page below
 * pays for no second query. No Journey at all is a 404 here too (ticket
 * 60): metadata streams in after the page, so a title returned for a
 * missing Journey would replace the not-found page's own.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}): Promise<Metadata> {
  const { journeyId } = await params;
  const journey = await getPublicJourney(journeyId);
  if (!journey) notFound();
  return journeyLinkMetadata(journey, journeyId);
}

/**
 * The participant runner's first screen: the Start Step itself, under the
 * Journey's title, with the description beneath the header (ticket 27 —
 * there is no title page in front of the Journey). Public and anonymous: no
 * session, no Project membership, no account — a Participant only ever
 * needs the link.
 *
 * Nothing is recorded by opening this page. The Start Step's Choices are a
 * form, and the Run is created — already holding the Start and the chosen
 * Step — when a Choice is taken. A Journey whose Start is an Ending shows
 * "The end" here and records no Run at all.
 *
 * The title, description, and Start Step come from the live Published
 * Version, never the `journey` row, so renaming a Journey after publishing
 * never changes what a Participant is looking at until the next publish.
 */
export default async function JourneyStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ journeyId: string }>;
  searchParams: Promise<{
    notice?: string | string[];
    decide?: string | string[];
    response?: string | string[];
  }>;
}) {
  const [{ journeyId }, { notice, decide, response }] = await Promise.all([
    params,
    searchParams,
  ]);

  const journey = await getPublicJourney(journeyId);
  // No such Journey at all: a 404, the same answer an unknown id gets
  // anywhere else. A Journey that exists but is not live gets the screen
  // below instead — "never published" and "taken down" read the same, so a
  // Participant learns nothing about a Journey they were not shown.
  if (!journey) notFound();

  if (journey.kind === "unavailable") {
    return (
      <RunnerFrame theme={journey.theme}>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            This journey isn&apos;t available
          </h1>
          <p className="text-muted-foreground">
            It has been taken down or hasn&apos;t been published yet.
          </p>
        </div>
      </RunnerFrame>
    );
  }

  const cookieStore = await cookies();
  const runId = cookieStore.get(runCookieName(journeyId))?.value;
  const found = runId ? await getRunForJourney(runId, journeyId) : null;
  // Only a Run still walking is worth returning to; one that reached an
  // Ending is finished, and this screen offers a fresh walk instead.
  const inProgress = found && found.run.endedAt === null ? found.run : null;

  const { document } = journey;
  // A Published Version passed publish-time validation, so its Start Step
  // exists; the reducer indexes it the same way.
  const startStep = document.steps[document.startStepId];

  return (
    <RunnerFrame
      title={journey.title}
      description={journey.description || undefined}
      theme={journey.theme}
    >
      {inProgress ? (
        // Native controls rather than the shared Button: this page stays a
        // Server Component with no client bundle, and the class already
        // matches the Choices below. Starting over is a POST an action owns,
        // since it changes what the next request will see.
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <p className="text-sm">
            You&apos;re partway through this journey. Choosing below starts it
            again from the beginning.
          </p>
          <a
            href={`/j/${journeyId}/${currentStepId(inProgress)}`}
            className={choiceLinkClassName}
          >
            Continue where you left off
          </a>
          <form action={startOverAction.bind(null, journeyId)}>
            <button type="submit" className={choiceLinkClassName}>
              Start over
            </button>
          </form>
        </div>
      ) : null}

      {/* The one notice this screen can be sent back with is a refusal — a
          required Prompt on the Start left blank — and `ResponseField`
          renders that at the field itself, so `ResponseNotice` here renders
          nothing for it; it stays for symmetry with every other Step, and
          for a future confirmation this screen might carry. The address is
          not rewritten here, since no Run exists to keep in step with. */}
      <ResponseNotice notice={notice} />

      {/* No "Start over" on an Ending here: with no Run begun there is
          nothing to start over from, and the Choices — when the Start has
          any — are the way in. A Start that is itself an Ending offers no
          Prompt either: a Run begins with a Choice, and without one there
          is no Run to record an answer against — links, then, which offer
          nothing on an Ending and say so. */}
      <StepView
        step={startStep}
        document={document}
        choices={
          startStep.choices.length === 0
            ? { kind: "links", href: (stepId) => `/j/${journeyId}/${stepId}` }
            : {
                kind: "form",
                action: chooseFromStartAction.bind(null, journeyId),
                refusal: responseRefusal(notice),
                // A deciding Prompt's answer (ticket 43): with no Run yet to
                // hold the Response, it comes back in the address with the
                // judge's pick, and the box shows it again — but only once
                // the judge has actually been asked (`decide` present); a
                // bare `?response=` on its own is never trusted back into
                // the box (ticket 43 F6).
                response:
                  typeof decide === "string" && typeof response === "string"
                    ? response
                    : undefined,
                decision: liveDecision(startStep, decide),
              }
        }
        startOver={null}
      />
    </RunnerFrame>
  );
}
