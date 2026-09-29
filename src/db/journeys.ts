// Database access only — `server-only` so a client import fails the build.
// Pure logic (input validation) lives under src/lib and stays importable
// from both sides.
import "server-only";

import { and, asc, count, eq, inArray, max } from "drizzle-orm";

import { db } from "@/db";
import type { MemberJourney, MemberProject } from "@/db/access";
import {
  changedFields,
  guardedWrite,
  rowExists,
  stillHolds,
  stillHoldsOrRetired,
} from "@/db/guarded-write";
import { lockProject } from "@/db/projects";
import { draft, journey, publishedVersion } from "@/db/schema";
import { createDraftDocument } from "@/lib/graph/document";
import { moveInOrder, type MoveDirection } from "@/lib/journey-order";
import { publishStateOf, type PublishState } from "@/lib/publish-state";
import {
  readThemeOverride,
  themePresetSchema,
  type ThemeOverride,
} from "@/lib/theme";
import type { WriteFailure } from "@/lib/write-result";

/**
 * Data access for Journeys, mirroring `@/db/projects`.
 *
 * A Journey belongs to a Project, so its authorization rides on the same
 * Project membership, resolved once in `@/db/access` (ticket 82): every read
 * and write a Member makes here takes the `MemberProject` or `MemberJourney`
 * that check hands back and never checks again, and an Author who is not a
 * Member of the Journey's Project cannot tell an existing Journey from one
 * that never existed.
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
  /**
   * The last write to the Journey row itself: a title or description edit,
   * a Theme change, a publish, or an unpublish. The Draft's document has
   * its own (`@/db/drafts`).
   */
  updatedAt: Date;
};

const journeyColumns = {
  id: journey.id,
  title: journey.title,
  description: journey.description,
  themePreset: journey.themePreset,
  themeAccent: journey.themeAccent,
  updatedAt: journey.updatedAt,
};

/**
 * The Journey itself plus the live pointer publish state is derived from;
 * `@/db/access` selects them too.
 */
export const journeyStateColumns = {
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
    updatedAt: Date;
  },
  publishState: PublishState,
): JourneySummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    publishState,
    theme: readThemeOverride(row),
    updatedAt: row.updatedAt,
  };
}

/** The publish state a read derives (see `@/lib/publish-state`). */
function stateOf(
  row: { liveVersionId: string | null },
  versionCount: number,
): PublishState {
  return publishStateOf({ liveVersionId: row.liveVersionId, versionCount });
}

/**
 * One `journey` row read with its publish state: the row's live pointer and
 * its own count of Published Versions, one more query.
 */
export async function summarizeJourney(row: {
  id: string;
  title: string;
  description: string;
  themePreset: string | null;
  themeAccent: string | null;
  updatedAt: Date;
  liveVersionId: string | null;
}): Promise<JourneySummary> {
  const versionCounts = await countVersionsByJourney([row.id]);
  return toSummary(row, stateOf(row, versionCounts.get(row.id) ?? 0));
}

/** The Author's order: `position` first, `created_at` breaking any tie. */
const listOrder = [asc(journey.position), asc(journey.createdAt)];

/** Every Journey in the Project, in the Author's order. */
export async function listJourneysForProject(
  project: MemberProject,
): Promise<JourneySummary[]> {
  const rows = await db
    .select(journeyStateColumns)
    .from(journey)
    .where(eq(journey.projectId, project.id))
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
 */
export async function createJourney(
  project: MemberProject,
  input: { title: string; description: string },
): Promise<JourneySummary> {
  const projectId = project.id;
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

/** The Journey fields its title form and Theme settings write, by column. */
type JourneyFields = {
  title: string;
  description: string;
  themePreset: string | null;
  themeAccent: string | null;
};

const journeyFieldColumns = {
  title: journey.title,
  description: journey.description,
  themePreset: journey.themePreset,
  themeAccent: journey.themeAccent,
} as const;

/** A title or Theme write's answer: the Journey as stored, or why not. */
export type JourneyWriteResult =
  { ok: true; journey: JourneySummary } | WriteFailure;

/**
 * The guarded write `updateJourney` and `setJourneyTheme` share (ticket 73),
 * the Journey's twin of `@/db/projects`' own: only the fields whose value
 * differs from `baseline` are written, each only while the row still holds
 * its baseline value, so another Member's change to the same field since is
 * answered `stale`. Publish, unpublish, and move write other columns and
 * never make these stale. `not-found` when the Journey went away since its
 * membership was resolved.
 */
async function updateJourneyFields(
  existing: MemberJourney,
  next: Partial<JourneyFields>,
  baseline: Partial<JourneyFields>,
): Promise<JourneyWriteResult> {
  const fields = changedFields(next, baseline);
  if (fields.length === 0) return { ok: true, journey: existing };

  const written = await guardedWrite(
    () =>
      db
        .update(journey)
        .set({
          ...Object.fromEntries(fields.map((field) => [field, next[field]])),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(journey.id, existing.id),
            ...fields.map((field) =>
              // A retired preset id reads back as the default, so the
              // preset guard also passes one (see `stillHoldsOrRetired`).
              field === "themePreset"
                ? stillHoldsOrRetired(
                    journeyFieldColumns.themePreset,
                    baseline.themePreset,
                    themePresetSchema.options,
                  )
                : stillHolds(journeyFieldColumns[field], baseline[field]),
            ),
          ),
        )
        .returning(journeyColumns),
    () => rowExists(journey, journey.id, existing.id),
  );
  if (!written.ok) return written;
  // Title, description, and Theme are all this changes; publish state is
  // whatever the membership check already read.
  return { ok: true, journey: toSummary(written.row, existing.publishState) };
}

/**
 * Edits a Journey's title and description. Its id — and so its URL — is
 * untouched. `baseline` is what the Member edited from.
 */
export function updateJourney(
  existing: MemberJourney,
  input: { title: string; description: string },
  baseline: { title: string; description: string },
): Promise<JourneyWriteResult> {
  return updateJourneyFields(
    existing,
    { title: input.title, description: input.description },
    { title: baseline.title, description: baseline.description },
  );
}

/** A Theme override as its two columns: no preset, no accent. */
function themeColumns(theme: ThemeOverride) {
  return {
    themePreset: theme.preset,
    themeAccent: theme.preset === null ? null : theme.accent,
  };
}

/**
 * Sets or clears a Journey's Theme override. A null preset clears it (the
 * Journey goes back to its Project's Theme); a set preset is taken whole
 * with `theme.accent` or none. The caller has already parsed the pair, and
 * the baseline it replaces, through the Journey Theme schema.
 */
export function setJourneyTheme(
  existing: MemberJourney,
  theme: ThemeOverride,
  baseline: ThemeOverride,
): Promise<JourneyWriteResult> {
  return updateJourneyFields(
    existing,
    themeColumns(theme),
    themeColumns(baseline),
  );
}

/**
 * Moves a Journey one place up or down in its Project's list. The whole
 * order is read and rewritten inside one transaction: normally only the two
 * swapped rows change, but a list left with equal positions (Journeys made
 * by a build older than migration 0006) is numbered properly by whichever
 * move first touches it, so the swap is visible rather than a no-op on
 * tied rows.
 *
 * A move off either end of the list is not an error, and neither is a
 * Journey another Member deleted a moment earlier: nothing changes and the
 * call answers ok, so a control that was already stale when clicked fails
 * quietly.
 */
export async function moveJourney(
  existing: MemberJourney,
  direction: MoveDirection,
): Promise<{ ok: true }> {
  const projectId = existing.projectId;
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

  return { ok: true };
}

/**
 * Hard-deletes a Journey. A Journey another Member deleted a moment earlier
 * is gone either way, so that is not a failure.
 */
export async function deleteJourney(
  existing: MemberJourney,
): Promise<{ ok: true }> {
  await db.delete(journey).where(eq(journey.id, existing.id));
  return { ok: true };
}
