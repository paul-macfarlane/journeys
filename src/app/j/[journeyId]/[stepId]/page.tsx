import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { RunHistory } from "@/components/runner/run-history";
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
 *
 * Two query parameters travel with a navigation and are read here, never
 * kept: `at` is the path index the browser came back to, which is what tells
 * a Back on a loop-closing Step from a Choice to that same Step, and `notice`
 * carries the one refusal a Participant is told about. `RunHistory` writes
 * the index into `history.state` for the next Back and strips both from the
 * address bar.
 */

/** The `at` parameter as the reducer wants it: a path index, or nothing. */
function parsePathIndex(raw: string | undefined): number | null {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;
}

export default async function RunStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ journeyId: string; stepId: string }>;
  searchParams: Promise<{ at?: string; notice?: string }>;
}) {
  const { journeyId, stepId } = await params;
  const { at, notice } = await searchParams;

  const cookieStore = await cookies();
  const runId = cookieStore.get(runCookieName(journeyId))?.value;
  if (!runId) redirect(`/j/${journeyId}`);

  const found = await getRunForJourney(runId, journeyId);
  if (!found) redirect(`/j/${journeyId}`);

  const { run, version } = found;
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

  return (
    <RunnerFrame>
      {/* A back navigation restored from the browser's cache would record
          nothing; this sends it back to the server, saying which entry of
          the path it came back to. */}
      <RunHistory pathIndex={path.length - 1} />

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">{version.title}</p>
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
      </div>

      {notice === "path-full" ? (
        <p className="text-muted-foreground text-sm">
          This journey has gone on too long to continue. Start over to keep
          going.
        </p>
      ) : null}

      <StepView
        step={step}
        document={version.document}
        stepHref={(targetStepId) => `/j/${journeyId}/${targetStepId}`}
        // A native button rather than the shared Button, for the same reason
        // as on the start screen: the page stays a Server Component.
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
