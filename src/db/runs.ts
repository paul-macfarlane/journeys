// Database access only — `server-only` so a client import fails the build.
// Pure logic (the document contract, the path reducer) lives under src/lib
// and stays importable from both sides.
import "server-only";

import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";

import { db } from "@/db";
import { journey, project, publishedVersion, response, run } from "@/db/schema";
import { logUnreadable } from "@/db/unreadable";
import {
  graphDocumentSchema,
  idSchema,
  type GraphDocument,
} from "@/lib/graph/document";
import type { RunState } from "@/lib/graph/run";
import {
  effectiveTheme,
  readThemeOverride,
  toThemePreset,
  type Theme,
} from "@/lib/theme";

/**
 * The Theme a Participant sees a Journey in: the Journey's override when it
 * has one, else its Project's (ticket 11). Read from the two rows on every
 * request rather than snapshotted into the Published Version — a Theme is
 * presentation, and setting one shows in the runner at once with no
 * publish. The four columns are selected together wherever a runner read
 * joins `journey` and `project`.
 */
// One level deep, which is as far as Drizzle nests a selection.
const themeColumns = {
  journeyPreset: journey.themePreset,
  journeyAccent: journey.themeAccent,
  projectPreset: project.themePreset,
  projectAccent: project.themeAccent,
};

function toTheme(row: {
  journeyPreset: string | null;
  journeyAccent: string | null;
  projectPreset: string;
  projectAccent: string | null;
}): Theme {
  return effectiveTheme(
    { preset: toThemePreset(row.projectPreset), accent: row.projectAccent },
    readThemeOverride({
      themePreset: row.journeyPreset,
      themeAccent: row.journeyAccent,
    }),
  );
}

/**
 * Data access for the participant runner. Unlike every other module under
 * `src/db`, nothing here checks Project membership — a Participant walking a
 * Journey is anonymous by design, and a Run's id (an unguessable
 * `crypto.randomUUID()`, see `src/lib/run-cookies.ts`) is its only write
 * credential. `getRunForJourney` still refuses a Run whose Published Version
 * belongs to a different Journey, so a Run cookie can never be used to read
 * or write another Journey's Run.
 *
 * Documents are parsed with `graphDocumentSchema` on the way out, as
 * `@/db/versions` does — a stored Published Version is always well-formed
 * (see `docs/adr/0001-graph-as-one-json-document.md`), and failing loudly on
 * a row that isn't is better than rendering garbage to a Participant.
 */

export type PublicJourney =
  | {
      kind: "live";
      versionId: string;
      title: string;
      description: string;
      document: GraphDocument;
      theme: Theme;
      /** The Project the Journey belongs to: its id, which the runner's header links the public Project page by (ticket 69), and its title, which that link and a link preview name above the Journey's. */
      projectId: string;
      projectTitle: string;
    }
  // The unavailable screen sits in the same frame, so it carries the Theme
  // too: a Journey taken down still belongs to a Project with a look, and a
  // live version that fails the document contract (ticket 83) reads the
  // same way — a Participant never meets a 500 for it.
  | { kind: "unavailable"; theme: Theme };

/**
 * A `published_version` row read through the document contract, never
 * trusted: a row that fails it reads as "unavailable," the same as a
 * Journey with no live version at all (ticket 83).
 */
export function toPublicJourney(row: {
  journeyId: string;
  versionId: string;
  title: string;
  description: string;
  document: unknown;
  theme: Theme;
  projectId: string;
  projectTitle: string;
}): PublicJourney {
  const parsed = graphDocumentSchema.safeParse(row.document);
  if (!parsed.success) {
    logUnreadable("published version", {
      journeyId: row.journeyId,
      versionId: row.versionId,
    });
    return { kind: "unavailable", theme: row.theme };
  }

  return {
    kind: "live",
    versionId: row.versionId,
    title: row.title,
    description: row.description,
    document: parsed.data,
    theme: row.theme,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
  };
}

/**
 * What an anonymous Participant may see of a Journey by id: its live
 * Published Version, or why there isn't one. Null for an unknown Journey id
 * (the runner 404s); `unavailable` when the Journey exists but has no
 * live pointer, whether it was never published or was later unpublished —
 * the two read the same to a Participant. Title and description come from
 * the Published Version, never the Journey row, so a rename after publish
 * never changes what a live or in-progress Run shows.
 *
 * Wrapped in React's `cache` so a page and its `generateMetadata` share one
 * query on a request, as `getPublicProject` does.
 */
export const getPublicJourney = cache(async function getPublicJourney(
  journeyId: string,
): Promise<PublicJourney | null> {
  const [row] = await db
    .select({
      versionId: publishedVersion.id,
      title: publishedVersion.title,
      description: publishedVersion.description,
      document: publishedVersion.document,
      projectId: project.id,
      projectTitle: project.title,
      theme: themeColumns,
    })
    .from(journey)
    .innerJoin(project, eq(project.id, journey.projectId))
    // Left, not inner: a Journey with no live version must still produce a
    // row, so it can be told apart from a Journey that does not exist.
    .leftJoin(publishedVersion, eq(publishedVersion.id, journey.liveVersionId))
    .where(eq(journey.id, journeyId))
    .limit(1);

  if (!row) return null;

  const theme = toTheme(row.theme);

  // The left join fills every `published_version` column from one row or
  // none, so the four are null together; narrowing on all of them keeps the
  // types honest without asserting.
  const { versionId, title, description, document } = row;
  if (
    versionId === null ||
    title === null ||
    description === null ||
    document === null
  ) {
    return { kind: "unavailable", theme };
  }

  return toPublicJourney({
    journeyId,
    versionId,
    title,
    description,
    document,
    theme,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
  });
});

/**
 * Starts a Run: one row pinned to the Published Version the Participant is
 * about to walk, recording the reducer's own starting state. A Run begins
 * with a Choice (ticket 27), and the Start Step may carry a Prompt, so the
 * answer given with that first Choice is written in the same transaction:
 * a Run that exists without the Response posted with it would be a Response
 * lost.
 */
export async function createRun({
  versionId,
  participantId,
  state,
  response: firstResponse,
}: {
  versionId: string;
  participantId: string;
  state: RunState;
  /** The Start Step's answer, when its Prompt was answered. */
  response?: { stepId: string; text: string };
}): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(run)
      .values({
        versionId,
        participantId,
        path: state.path,
        backtrackCount: state.backtrackCount,
        endedAt: state.endedAt,
        outcomeId: state.outcomeId,
      })
      .returning({ id: run.id });

    if (firstResponse) {
      await tx.insert(response).values({ runId: created.id, ...firstResponse });
    }

    return created;
  });
}

export type RunForJourney = {
  run: {
    id: string;
    versionId: string;
    participantId: string;
    path: string[];
    backtrackCount: number;
    startedAt: Date;
    endedAt: Date | null;
    outcomeId: string | null;
  };
  version: { title: string; description: string; document: GraphDocument };
  /** The Project the Run's Journey belongs to, for the header's way out (ticket 69). */
  project: { id: string; title: string };
  /** The Theme the Step pages paint, read fresh on every request. */
  theme: Theme;
};

/**
 * A Run's row read through the document contract, never trusted — and its
 * `path` validated the same way (ticket 83): a Run whose Published Version
 * document no longer parses, or whose stored path is not an array of Step
 * ids, answers null exactly as an unknown Run id does, so the step page
 * restarts it from the Start instead of 500ing.
 */
export function toRunForJourney(row: {
  run: {
    id: string;
    versionId: string;
    participantId: string;
    path: unknown;
    backtrackCount: number;
    startedAt: Date;
    endedAt: Date | null;
    outcomeId: string | null;
  };
  version: { title: string; description: string; document: unknown };
  project: { id: string; title: string };
  theme: Theme;
}): RunForJourney | null {
  const document = graphDocumentSchema.safeParse(row.version.document);
  const path = z.array(idSchema).safeParse(row.run.path);
  if (!document.success || !path.success) {
    logUnreadable("run", { runId: row.run.id, versionId: row.run.versionId });
    return null;
  }

  return {
    run: { ...row.run, path: path.data },
    version: { ...row.version, document: document.data },
    project: row.project,
    theme: row.theme,
  };
}

/**
 * The Run named by a Run cookie, together with the Published Version it is
 * pinned to — joined through `published_version` and refused (null) when
 * that version does not belong to `journeyId`, so a Run cookie minted on one
 * Journey can never open a step page on another. Also null for an unknown
 * Run id, which a step page answers the same way: back to the Start Step.
 */
export async function getRunForJourney(
  runId: string,
  journeyId: string,
): Promise<RunForJourney | null> {
  // Selected in the shape the result has: Drizzle nests a selection object
  // as one, so the Run's columns, the version's, and the Theme's arrive
  // already apart.
  const [row] = await db
    .select({
      run: {
        id: run.id,
        versionId: run.versionId,
        participantId: run.participantId,
        path: run.path,
        backtrackCount: run.backtrackCount,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        outcomeId: run.outcomeId,
      },
      version: {
        title: publishedVersion.title,
        description: publishedVersion.description,
        document: publishedVersion.document,
      },
      project: { id: project.id, title: project.title },
      theme: themeColumns,
    })
    .from(run)
    .innerJoin(publishedVersion, eq(publishedVersion.id, run.versionId))
    .innerJoin(journey, eq(journey.id, publishedVersion.journeyId))
    .innerJoin(project, eq(project.id, journey.projectId))
    .where(and(eq(run.id, runId), eq(publishedVersion.journeyId, journeyId)))
    .limit(1);

  if (!row) return null;

  return toRunForJourney({ ...row, theme: toTheme(row.theme) });
}

/**
 * Persists the reducer's next state after a move — `path`, `backtrackCount`,
 * `endedAt`, and `outcomeId` are the whole of what the reducer changes, so
 * they are the whole of what is written back.
 */
export async function saveRunState(
  runId: string,
  state: RunState,
): Promise<void> {
  await db
    .update(run)
    .set({
      path: state.path,
      backtrackCount: state.backtrackCount,
      endedAt: state.endedAt,
      outcomeId: state.outcomeId,
    })
    .where(eq(run.id, runId));
}
