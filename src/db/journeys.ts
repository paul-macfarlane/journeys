// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, asc, count, eq, inArray, max } from "drizzle-orm";

import { db } from "@/db";
import { draft, journey, member, project, publishedVersion } from "@/db/schema";
import { createDraftDocument } from "@/lib/graph/document";
import { moveInOrder, type MoveDirection } from "@/lib/journey-order";
import { publishStateOf, type PublishState } from "@/lib/publish-state";
import { readThemeOverride, type ThemeOverride } from "@/lib/theme";

/**
 * Data access for Journeys, mirroring `@/db/projects`.
 *
 * A Journey belongs to a Project, so its authorization rides on the same
 * Project membership: every read and write here re-checks it against the
 * signed-in Author, and an Author who is not a Member of the Journey's
 * Project cannot tell an existing Journey from one that never existed.
 *
 * Publish state is not a column: it is derived from the live-version
 * pointer and the count of Published Versions, so a Journey can never be
 * marked published while pointing at nothing (see `@/lib/publish-state`).
 *
 * A Project's Journeys are listed in the Author's order: `position`, then
 * `created_at` for any tie. A new Journey goes last, and `moveJourney`
 * swaps one with its neighbour (see `@/lib/journey-order`).
 */

export type JourneySummary = {
  id: string;
  title: string;
  description: string;
  publishState: PublishState;
  /** The Journey's Theme override (ticket 11); a null preset means none. */
  theme: ThemeOverride;
};

const journeyColumns = {
  id: journey.id,
  title: journey.title,
  description: journey.description,
  themePreset: journey.themePreset,
  themeAccent: journey.themeAccent,
};

/** The Journey itself plus the live pointer publish state is derived from. */
const journeyStateColumns = {
  ...journeyColumns,
  liveVersionId: journey.liveVersionId,
};

/**
 * How many Published Versions each of these Journeys has, as its own
 * grouped query rather than a correlated subquery inside the Journey select:
 * Drizzle renders an interpolated column unqualified when the surrounding
 * query joins nothing, which turns `published_version.journey_id =
 * journey.id` into a comparison of two columns of the inner table — legal
 * SQL that silently counts zero. Grouping keeps it one round trip for a
 * whole Project.
 */
async function countVersionsByJourney(
  journeyIds: string[],
): Promise<Map<string, number>> {
  if (journeyIds.length === 0) return new Map();

  const rows = await db
    .select({
      journeyId: publishedVersion.journeyId,
      versionCount: count(),
    })
    .from(publishedVersion)
    .where(inArray(publishedVersion.journeyId, journeyIds))
    .groupBy(publishedVersion.journeyId);

  return new Map(rows.map((row) => [row.journeyId, row.versionCount]));
}

/**
 * A `journey` row as the app reads it, with the publish state the caller
 * has already derived — from the live pointer and the version count on a
 * read, or carried over from the membership check on a write that changes
 * neither.
 */
function toSummary(
  row: {
    id: string;
    title: string;
    description: string;
    themePreset: string | null;
    themeAccent: string | null;
  },
  publishState: PublishState,
): JourneySummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    publishState,
    theme: readThemeOverride(row),
  };
}

/** The publish state a read derives (see `@/lib/publish-state`). */
function stateOf(
  row: { liveVersionId: string | null },
  versionCount: number,
): PublishState {
  return publishStateOf({ liveVersionId: row.liveVersionId, versionCount });
}

/** The Author's order: `position` first, `created_at` breaking any tie. */
const listOrder = [asc(journey.position), asc(journey.createdAt)];

/**
 * Serializes the writes that number a Project's Journeys. Two creates, or
 * a create and a move, running at once under READ COMMITTED would both read
 * the same positions and write the same number twice; holding the Project
 * row makes the second wait for the first and read what it wrote.
 */
async function lockProject(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: string,
): Promise<void> {
  await tx
    .select({ id: project.id })
    .from(project)
    .where(eq(project.id, projectId))
    .for("update");
}

/** Every Journey in the Project, in the Author's order. */
export async function listJourneysForProject(
  projectId: string,
): Promise<JourneySummary[]> {
  const rows = await db
    .select(journeyStateColumns)
    .from(journey)
    .where(eq(journey.projectId, projectId))
    .orderBy(...listOrder);

  const versionCounts = await countVersionsByJourney(rows.map((row) => row.id));

  return rows.map((row) =>
    toSummary(row, stateOf(row, versionCounts.get(row.id) ?? 0)),
  );
}

export type PublicJourneySummary = {
  id: string;
  title: string;
  description: string;
};

/**
 * The Journeys of a Project an anonymous Participant may see: the ones with
 * a live Published Version, in the Author's order, for the public Project
 * page at `/p/<id>` (ticket 07). No membership check — the page is public —
 * and no publish state, because every Journey here is published; one that
 * was never published or was unpublished is simply absent. Title and
 * description are the live version's, never the Journey row's, exactly as
 * the runner shows them (`getPublicJourney` in `@/db/runs`), so a rename
 * after publishing changes nothing a Participant sees until the next
 * publish. The Project itself is `getPublicProject` in `@/db/projects`.
 */
export async function listPublicJourneysForProject(
  projectId: string,
): Promise<PublicJourneySummary[]> {
  return (
    db
      .select({
        id: journey.id,
        title: publishedVersion.title,
        description: publishedVersion.description,
      })
      .from(journey)
      // Inner, not left: a Journey with no live pointer has no row to show.
      .innerJoin(
        publishedVersion,
        eq(publishedVersion.id, journey.liveVersionId),
      )
      .where(eq(journey.projectId, projectId))
      .orderBy(...listOrder)
  );
}

/**
 * Creates a Journey inside a Project, with the Draft every Journey has: one
 * Start Step and nothing else. Both rows in one transaction, because a
 * Journey without a Draft is a Journey an Author could never author. The
 * new Journey goes last in the Project's list.
 *
 * The caller is responsible for having already confirmed the Author is a
 * Member of `projectId` — every action that calls this resolves the Project
 * through `getProjectForMember` first, which is where that check lives.
 */
export async function createJourney(
  projectId: string,
  input: { title: string; description: string },
): Promise<JourneySummary> {
  return db.transaction(async (tx) => {
    await lockProject(tx, projectId);

    const [{ last }] = await tx
      .select({ last: max(journey.position) })
      .from(journey)
      .where(eq(journey.projectId, projectId));

    const [created] = await tx
      .insert(journey)
      .values({
        projectId,
        title: input.title,
        description: input.description,
        position: last === null ? 0 : last + 1,
      })
      .returning(journeyColumns);

    await tx
      .insert(draft)
      .values({ journeyId: created.id, document: createDraftDocument() });

    // A Journey that has just come into being has no Published Version and
    // no live pointer, so its state is not worth a second query.
    return toSummary(created, "never-published");
  });
}

/**
 * The Journey behind a Project id and Journey id pair, but only for one of
 * the Project's Members. Returns null for a non-Member, an unknown Project,
 * and an unknown Journey alike, so callers can answer all three with the
 * same 404 — including a real Journey asked for under the wrong Project.
 */
export async function getJourneyForMember(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<JourneySummary | null> {
  const [row] = await db
    .select(journeyStateColumns)
    .from(journey)
    .innerJoin(project, eq(project.id, journey.projectId))
    .innerJoin(member, eq(member.projectId, project.id))
    .where(
      and(
        eq(project.id, projectId),
        eq(journey.id, journeyId),
        eq(member.userId, userId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const versionCounts = await countVersionsByJourney([row.id]);
  return toSummary(row, stateOf(row, versionCounts.get(row.id) ?? 0));
}

/**
 * Edits a Journey's title and description. Its id — and so its URL — is
 * untouched. Returns null when the Author is not a Member of the Journey's
 * Project, or the Journey doesn't exist under that Project.
 */
export async function updateJourney(
  projectId: string,
  journeyId: string,
  input: { title: string; description: string },
  userId: string,
): Promise<JourneySummary | null> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  const [updated] = await db
    .update(journey)
    .set({
      title: input.title,
      description: input.description,
      updatedAt: new Date(),
    })
    .where(eq(journey.id, existing.id))
    .returning(journeyColumns);

  // A title and a description are all this changes; publish state is
  // whatever the membership check already read.
  return updated ? toSummary(updated, existing.publishState) : null;
}

/**
 * Sets or clears a Journey's Theme override. A null preset clears it (the
 * Journey goes back to its Project's Theme); a set preset is taken whole
 * with `theme.accent` or none. The caller has already parsed the pair
 * through the Journey Theme schema. Returns null when the Author is not a
 * Member of the Journey's Project, or the Journey doesn't exist under it.
 */
export async function setJourneyTheme(
  projectId: string,
  journeyId: string,
  theme: ThemeOverride,
  userId: string,
): Promise<JourneySummary | null> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return null;

  const [updated] = await db
    .update(journey)
    .set({
      themePreset: theme.preset,
      themeAccent: theme.preset === null ? null : theme.accent,
      updatedAt: new Date(),
    })
    .where(eq(journey.id, existing.id))
    .returning(journeyColumns);

  return updated ? toSummary(updated, existing.publishState) : null;
}

/**
 * Moves a Journey one place up or down in its Project's list. The whole
 * order is read and rewritten inside one transaction: normally only the two
 * swapped rows change, but a list left with equal positions (Journeys made
 * by a build older than migration 0006) is numbered properly by whichever
 * move first touches it, so the swap is visible rather than a no-op on
 * tied rows.
 *
 * Returns false when the Author is not a Member of the Journey's Project or
 * the Journey is not there, which callers answer with the same 404 as an
 * unknown id. A move off either end of the list is not an error: nothing
 * changes and the call returns true, so a control that was already stale
 * when clicked fails quietly.
 */
export async function moveJourney(
  projectId: string,
  journeyId: string,
  direction: MoveDirection,
  userId: string,
): Promise<boolean> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return false;

  await db.transaction(async (tx) => {
    await lockProject(tx, projectId);

    const rows = await tx
      .select({ id: journey.id, position: journey.position })
      .from(journey)
      .where(eq(journey.projectId, projectId))
      .orderBy(...listOrder);

    const next = moveInOrder(
      rows.map((row) => row.id),
      existing.id,
      direction,
    );
    if (!next) return;

    const before = new Map(rows.map((row) => [row.id, row.position]));
    for (const [index, id] of next.entries()) {
      if (before.get(id) === index) continue;
      await tx
        .update(journey)
        .set({ position: index })
        .where(eq(journey.id, id));
    }
  });

  return true;
}

/**
 * Hard-deletes a Journey. Returns false when the Author is not a Member of
 * its Project, which callers answer with the same 404 as an unknown id.
 */
export async function deleteJourney(
  projectId: string,
  journeyId: string,
  userId: string,
): Promise<boolean> {
  const existing = await getJourneyForMember(projectId, journeyId, userId);
  if (!existing) return false;

  await db.delete(journey).where(eq(journey.id, existing.id));
  return true;
}
