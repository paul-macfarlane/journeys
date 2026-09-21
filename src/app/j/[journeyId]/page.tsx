import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { choiceLinkClassName } from "@/components/runner/step-view";
import { RunnerFrame } from "@/components/runner/runner-frame";
import { getPublicJourney, getRunForJourney } from "@/db/runs";
import { currentStepId } from "@/lib/graph/run";
import { runCookieName } from "@/lib/run-cookies";

import { beginRunAction } from "./actions";

/**
 * The participant runner's start screen. Public and anonymous: no session, no
 * Project membership, no account — a Participant only ever needs the link.
 *
 * The title and description come from the live Published Version, never the
 * `journey` row, so renaming a Journey after publishing never changes what a
 * Participant is looking at until the next publish.
 */
export default async function JourneyStartPage({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}) {
  const { journeyId } = await params;

  const journey = await getPublicJourney(journeyId);
  // No such Journey at all: a 404, the same answer an unknown id gets
  // anywhere else. A Journey that exists but is not live gets the screen
  // below instead — "never published" and "taken down" read the same, so a
  // Participant learns nothing about a Journey they were not shown.
  if (!journey) notFound();

  if (journey.kind === "unavailable") {
    return (
      <RunnerFrame>
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

  return (
    <RunnerFrame>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {journey.title}
        </h1>
        {journey.description ? (
          <p className="text-muted-foreground text-lg">{journey.description}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {inProgress ? (
          <a
            href={`/j/${journeyId}/${currentStepId(inProgress)}`}
            className={choiceLinkClassName}
          >
            Continue where you left off
          </a>
        ) : null}

        {/* Starting a Run writes a row and two cookies, so it is a POST an
            action owns, not a link somebody can prefetch. */}
        <form action={beginRunAction.bind(null, journeyId)}>
          <button type="submit" className={choiceLinkClassName}>
            {inProgress ? "Start over" : "Begin"}
          </button>
        </form>
      </div>
    </RunnerFrame>
  );
}
