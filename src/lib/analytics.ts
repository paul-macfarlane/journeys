import {
  hasOutcome,
  hasStep,
  isEnding,
  stepName,
  type GraphDocument,
} from "@/lib/graph/document";

/**
 * Analytics for one Published Version, computed from its Runs' paths and
 * nothing else — there is no event table (spec, "Run"). Pure and
 * database-free: the page reads the version's document and its Run rows,
 * and this turns them into every number the Analytics tab shows, so the
 * whole of the arithmetic can be checked by hand in `analytics.test.ts`.
 *
 * A Run's path is the route its Participant is on now, one entry per visit,
 * repeats included (ADR-0002), and "current" is its last entry. Everything
 * below follows from reading paths that way:
 *
 * - A Run is a start. It is completed when its last entry is an Ending of
 *   the document and abandoned otherwise — the spec's rule ("a Run whose
 *   last step is not an Ending … is an abandonment"), read off the path
 *   alone, so a row's `ended_at` is never consulted and the map and the
 *   totals can never disagree.
 * - Abandonment is counted on the last entry only: a Step a Participant
 *   walked through and left is not one that lost them.
 * - A Choice's take-rate counts every traversal — each consecutive pair of
 *   entries that is one of the source Step's Choices — over every visit to
 *   the source Step. A Choice walked twice in one Run counts twice. Every
 *   visit to a Step ends in exactly one of its Choices or as the Run's last
 *   entry, so a Step's Choices and the Runs that stop on it account for its
 *   visits exactly once.
 * - Two Choices of one Step that lead to the same Step cannot be told apart
 *   in a path, which records Steps and not Choices; they share the pair's
 *   number rather than one of them being guessed at.
 */

/** What analytics needs of a Run: which version it is pinned to, and its path. */
export type RunPath = {
  versionId: string;
  path: string[];
};

export type StepStat = {
  stepId: string;
  /** Path entries naming this Step, across every Run — repeats included. */
  visits: number;
  /** Runs whose last entry is this Step while it is not an Ending. */
  abandoned: number;
  /** Runs whose last entry is this Step while it is an Ending. */
  ended: number;
};

export type ChoiceStat = {
  choiceId: string;
  stepId: string;
  targetStepId: string;
  /** Consecutive path pairs from this Choice's Step to its target. */
  traversals: number;
  /** `traversals` over visits to the Step; null while no Run has visited it. */
  share: number | null;
};

/**
 * One bar of the Runs-by-Outcome chart. Completed Runs are grouped by the
 * Ending's Outcome; an Ending with no Outcome is a group of its own under
 * its title (ticket 24: an Ending is an outcome in itself); and the Runs
 * that stopped short are the Abandoned group, so the bars sum to the starts.
 */
export type OutcomeGroup = {
  key: string;
  kind: "outcome" | "ending" | "abandoned";
  label: string;
  runs: number;
  /** `runs` over starts; null while there are no Runs at all. */
  share: number | null;
};

export type VersionAnalytics = {
  starts: number;
  completions: number;
  abandoned: number;
  /** `completions` over starts; null while there are no Runs at all. */
  completionRate: number | null;
  steps: Record<string, StepStat>;
  choices: Record<string, ChoiceStat>;
  /** Most Runs first, ties by label; Abandoned always last. */
  outcomes: OutcomeGroup[];
};

function share(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

/** A consecutive pair of path entries, keyed for counting. */
function pairKey(from: string, to: string): string {
  // A NUL cannot be in a Step id that came through JSON without being a
  // deliberate choice; it keeps "a" + "bc" apart from "ab" + "c".
  return `${from}\u0000${to}`;
}

/**
 * Every number the Analytics tab shows for `versionId`, from `document` (the
 * version's own, so every Step, Choice, and Outcome is as it was published)
 * and `runs`. Runs pinned to any other version are ignored here as well as
 * by the query that fetched them, so the rule has one testable home. A Run
 * with an empty path is not a start (no reducer writes one; a row is a row).
 * A Run whose last entry names a Step the document does not have counts as
 * a start and in the Abandoned total, and on no Step's own figure — there
 * is no box to put it on.
 */
export function analyticsForVersion(
  versionId: string,
  document: GraphDocument,
  runs: RunPath[],
): VersionAnalytics {
  const steps: Record<string, StepStat> = {};
  for (const stepId of Object.keys(document.steps)) {
    steps[stepId] = { stepId, visits: 0, abandoned: 0, ended: 0 };
  }

  const pairs = new Map<string, number>();
  const endedByGroup = new Map<string, number>();
  let starts = 0;
  let completions = 0;

  for (const run of runs) {
    if (run.versionId !== versionId) continue;
    if (run.path.length === 0) continue;
    starts += 1;

    for (const [index, stepId] of run.path.entries()) {
      if (!hasStep(document, stepId)) continue;
      steps[stepId].visits += 1;

      const next = run.path[index + 1];
      if (next === undefined) continue;
      const key = pairKey(stepId, next);
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }

    const last = run.path[run.path.length - 1];
    if (!hasStep(document, last)) continue;
    const step = document.steps[last];
    if (isEnding(step)) {
      completions += 1;
      steps[last].ended += 1;
      const group = groupKeyOf(document, last);
      endedByGroup.set(group, (endedByGroup.get(group) ?? 0) + 1);
    } else {
      steps[last].abandoned += 1;
    }
  }

  const choices: Record<string, ChoiceStat> = {};
  for (const step of Object.values(document.steps)) {
    for (const choice of step.choices) {
      // Only a pair that is one of the Step's Choices is a traversal; a
      // pair that is not (nothing the runner writes, but a row is a row)
      // is a visit that took no Choice.
      const traversals = pairs.get(pairKey(step.id, choice.targetStepId)) ?? 0;
      choices[choice.id] = {
        choiceId: choice.id,
        stepId: step.id,
        targetStepId: choice.targetStepId,
        traversals,
        share: share(traversals, steps[step.id].visits),
      };
    }
  }

  const abandoned = starts - completions;

  return {
    starts,
    completions,
    abandoned,
    completionRate: share(completions, starts),
    steps,
    choices,
    outcomes: outcomeGroups(document, endedByGroup, starts, abandoned),
  };
}

/** Which bar a Run that ended on `stepId` belongs to. */
function groupKeyOf(document: GraphDocument, stepId: string): string {
  const { outcomeId } = document.steps[stepId];
  return outcomeId !== null && hasOutcome(document, outcomeId)
    ? `outcome:${outcomeId}`
    : `ending:${stepId}`;
}

/**
 * Every group the document can produce — each Outcome it defines and each
 * Ending without one — whether or not any Run reached it, so an Outcome
 * nothing reaches is a bar at zero rather than a bar that is missing; then
 * Abandoned. Most Runs first, ties broken by label so the order is stable
 * across renders and Postgres's reordering of jsonb keys.
 */
function outcomeGroups(
  document: GraphDocument,
  endedByGroup: Map<string, number>,
  starts: number,
  abandoned: number,
): OutcomeGroup[] {
  const groups: OutcomeGroup[] = [];

  for (const outcome of Object.values(document.outcomes)) {
    const key = `outcome:${outcome.id}`;
    const runs = endedByGroup.get(key) ?? 0;
    groups.push({
      key,
      kind: "outcome",
      label: outcome.label,
      runs,
      share: share(runs, starts),
    });
  }

  for (const step of Object.values(document.steps)) {
    if (!isEnding(step)) continue;
    const key = groupKeyOf(document, step.id);
    if (!key.startsWith("ending:")) continue;
    const runs = endedByGroup.get(key) ?? 0;
    groups.push({
      key,
      kind: "ending",
      label: stepName(step),
      runs,
      share: share(runs, starts),
    });
  }

  groups.sort((a, b) => b.runs - a.runs || a.label.localeCompare(b.label));

  groups.push({
    key: "abandoned",
    kind: "abandoned",
    label: "Abandoned",
    runs: abandoned,
    share: share(abandoned, starts),
  });

  return groups;
}

/** A share as the tab prints it: a whole percent, or a dash for none. */
export function formatShare(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/**
 * Which of a Journey's Published Versions the Analytics tab reads: the one
 * the address names when it is one of them, else the live one, else the
 * newest — `versions` arrive newest first — and null when there are none.
 * An id that is not one of this Journey's versions is treated as no id at
 * all, so a foreign id can never choose a version this Journey does not own.
 */
export function chooseVersionId(
  versions: { id: string; isLive: boolean }[],
  requested: string | string[] | undefined,
): string | null {
  const value = Array.isArray(requested) ? requested[0] : requested;
  const named = versions.find((version) => version.id === value);
  if (named) return named.id;

  const live = versions.find((version) => version.isLive);
  return live?.id ?? versions[0]?.id ?? null;
}
