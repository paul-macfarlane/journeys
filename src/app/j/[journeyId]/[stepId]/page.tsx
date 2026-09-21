import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ReloadOnRestore } from "@/components/runner/reload-on-restore";
import { RunnerFrame } from "@/components/runner/runner-frame";
import { choiceLinkClassName, StepView } from "@/components/runner/step-view";
import { getRunForJourney, saveRunState } from "@/db/runs";
import { navigateTo } from "@/lib/graph/run";
import { runCookieName } from "@/lib/run-cookies";

import { beginRunAction } from "../actions";

/**
 * One Step of a Run. Every Step has a URL of its own so the browser's back
 * button walks the Journey the way an in-app Back control does — which is why
 * this page, unusually, writes to the database while it renders: a back
 * navigation is a plain GET, and if it did not record the backtrack here it
 * would not be recorded at all.
 *
 * The Run cookie is the only credential. Without one, or with one naming a
 * Run of some other Journey, there is nothing to resume and the Participant
 * goes to the start screen. A Run that does resume keeps walking the
 * Published Version it was pinned to, even if the Journey was unpublished
 * mid-walk: only the start screen and a cookie-less step URL answer
 * "unavailable".
 */
export default async function RunStepPage({
  params,
}: {
  params: Promise<{ journeyId: string; stepId: string }>;
}) {
  const { journeyId, stepId } = await params;

  const cookieStore = await cookies();
  const runId = cookieStore.get(runCookieName(journeyId))?.value;
  if (!runId) redirect(`/j/${journeyId}`);

  const found = await getRunForJourney(runId, journeyId);
  if (!found) redirect(`/j/${journeyId}`);

  const { run, version } = found;
  const moved = navigateTo(version.document, run, stepId, new Date());

  // Not a Step this Run can reach from where it stands (a typed URL, a stale
  // link, a Choice that is no longer offered): back to where it stands.
  if (moved.kind === "refused") {
    redirect(`/j/${journeyId}/${moved.currentStepId}`);
  }
  if (moved.kind === "moved") {
    await saveRunState(run.id, moved.state);
  }

  // The saved path, so Back names the Step actually behind this one.
  const path = moved.kind === "moved" ? moved.state.path : run.path;
  const previousStepId = path.length > 1 ? path[path.length - 2] : null;
  const step = version.document.steps[stepId];

  return (
    <RunnerFrame>
      {/* A back navigation restored from the browser's cache would record
          nothing; this sends it back to the server. */}
      <ReloadOnRestore />

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">{version.title}</p>
        {previousStepId ? (
          <a
            href={`/j/${journeyId}/${previousStepId}`}
            className="text-muted-foreground hover:text-foreground self-start text-sm"
          >
            ← Back
          </a>
        ) : null}
      </div>

      <StepView
        step={step}
        document={version.document}
        stepHref={(targetStepId) => `/j/${journeyId}/${targetStepId}`}
        startOver={
          <form action={beginRunAction.bind(null, journeyId)}>
            <button type="submit" className={choiceLinkClassName}>
              Start over
            </button>
          </form>
        }
      />
    </RunnerFrame>
  );
}
