"use server";

import { revalidatePath } from "next/cache";

import {
  failureResult,
  firstIssue,
  type ActionFailure,
  type ActionResult,
} from "@/lib/action-result";
import { journeyForMember, projectForMember } from "@/db/access";
import { saveDraft } from "@/db/drafts";
import {
  createJourney,
  deleteJourney,
  moveJourney,
  setJourneyTheme,
  updateJourney,
} from "@/db/journeys";
import { publishDraft, restoreVersion, unpublishJourney } from "@/db/versions";
import { requireSession } from "@/lib/session";
import {
  createJourneySchema,
  draftVersionSchema,
  journeyThemeSchema,
  moveDirectionSchema,
  updateJourneySchema,
} from "@/lib/validation/journey";
import { notFound } from "@/lib/write-result";

/**
 * Server actions behind the Journey dialogs, mirroring
 * `@/app/projects/actions`.
 *
 * Each one is a public endpoint, so each re-reads the session and re-parses
 * its input rather than trusting the form that called it, and resolves the
 * Journey (or Project) through the membership seam before the data layer is
 * asked anything. They return an `ActionResult` the dialog can render
 * inline.
 */

function revalidateJourneyPaths() {
  revalidatePath("/projects/[projectId]", "page");
  revalidatePath("/projects/[projectId]/journeys/[journeyId]", "page");
}

/** A non-Member, or no such Journey or Project: the page's 404, in words. */
const noJourney = () => failureResult(notFound(), { missing: "journey" });

export async function createJourneyAction(
  projectId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = createJourneySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  // An Author who is not a Member of this Project cannot create a Journey
  // inside it: `createJourney` takes only a Project resolved for a Member.
  const project = await projectForMember(projectId, session.user.id);
  if (!project) return failureResult(notFound(), { missing: "project" });

  const created = await createJourney(project, parsed.data);
  revalidateJourneyPaths();
  return { ok: true, id: created.id };
}

/**
 * Edits the Journey's title and description. `baseline` is what the Member
 * edited from, parsed by the same schema: another Member's change to a field
 * this write changes is refused as stale rather than overwritten (ticket 73).
 */
export async function updateJourneyAction(
  projectId: string,
  journeyId: string,
  input: unknown,
  baseline: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = updateJourneySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const previous = updateJourneySchema.safeParse(baseline);
  if (!previous.success) {
    return { ok: false, error: firstIssue(previous.error.issues) };
  }

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return noJourney();

  const updated = await updateJourney(journey, parsed.data, previous.data);
  if (!updated.ok) return failureResult(updated, { missing: "journey" });

  revalidateJourneyPaths();
  return { ok: true, id: updated.journey.id };
}

/**
 * Sets or clears a Journey's Theme override (ticket 11). A null preset is
 * the clear; the schema drops any accent sent with it. The runner reads the
 * rows on every request, so only the Author's pages need revalidating.
 * `baseline` is the override the Member replaced — the Theme fields' last
 * saved value, or the checkbox's Theme before it was clicked — and guards
 * the write (ticket 73).
 */
export async function setJourneyThemeAction(
  projectId: string,
  journeyId: string,
  input: unknown,
  baseline: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = journeyThemeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const previous = journeyThemeSchema.safeParse(baseline);
  if (!previous.success) {
    return { ok: false, error: firstIssue(previous.error.issues) };
  }

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return noJourney();

  const updated = await setJourneyTheme(journey, parsed.data, previous.data);
  if (!updated.ok) return failureResult(updated, { missing: "journey" });

  revalidateJourneyPaths();
  return { ok: true, id: updated.journey.id };
}

/**
 * Moves a Journey one place up or down in its Project's list. Nothing
 * happens off either end, so a stale control is harmless.
 */
export async function moveJourneyAction(
  projectId: string,
  journeyId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = moveDirectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return noJourney();

  await moveJourney(journey, parsed.data);

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
}

export async function deleteJourneyAction(
  projectId: string,
  journeyId: string,
): Promise<ActionResult> {
  const session = await requireSession();

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return noJourney();

  await deleteJourney(journey);

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
}

/**
 * A saved Draft carries its new version, which the editor's next save is
 * guarded by. A failed save carries the Step whose rich text was refused
 * when there is one, so the editor can take the Author to it rather than
 * only saying no; a stale one says another Member saved first (ticket 73).
 */
export type SaveDraftActionResult =
  { ok: true; id: string; version: number } | ActionFailure;

/**
 * Stores a Journey's whole Draft document, guarded by `version`, the Draft
 * version the editor last read or stored.
 */
export async function saveDraftAction(
  projectId: string,
  journeyId: string,
  input: unknown,
  version: unknown,
): Promise<SaveDraftActionResult> {
  const session = await requireSession();

  const expected = draftVersionSchema.safeParse(version);
  if (!expected.success) {
    return { ok: false, error: firstIssue(expected.error.issues) };
  }

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return noJourney();

  const saved = await saveDraft(journey, input, expected.data);
  if (!saved.ok) {
    return failureResult(saved, { missing: "journey", stale: "draft" });
  }

  revalidateJourneyPaths();
  return { ok: true, id: journeyId, version: saved.version };
}

/**
 * A refused publish carries every problem with the Draft, so an Author sees
 * the whole list rather than the first one. A publish that went through
 * carries the Draft version it published — the one it was guarded by, which
 * is the version the editor's flush of a just-typed edit left — so the page
 * can tell a later edit from the publish's own settling.
 */
export type PublishJourneyActionResult =
  { ok: true; versionNumber: number; draftVersion: number } | ActionFailure;

/**
 * Publishes a Journey's Draft as its next Published Version. A Draft that
 * fails publish-time validation is refused and nothing is written. So is a
 * Draft another Member saved since the page read `version` (ticket 73), and
 * a Draft whose row cannot be read.
 */
export async function publishJourneyAction(
  projectId: string,
  journeyId: string,
  version: unknown,
): Promise<PublishJourneyActionResult> {
  const session = await requireSession();

  const expected = draftVersionSchema.safeParse(version);
  if (!expected.success) {
    return { ok: false, error: firstIssue(expected.error.issues) };
  }

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return noJourney();

  const published = await publishDraft(journey, expected.data);
  if (!published.ok) {
    return failureResult(published, { missing: "journey", stale: "draft" });
  }

  revalidateJourneyPaths();

  return {
    ok: true,
    versionNumber: published.versionNumber,
    draftVersion: expected.data,
  };
}

/** Clears a Journey's live pointer. Every Published Version stays. */
export async function unpublishJourneyAction(
  projectId: string,
  journeyId: string,
): Promise<ActionResult> {
  const session = await requireSession();

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return noJourney();

  await unpublishJourney(journey);

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
}

export type RestoreVersionActionResult =
  { ok: true; id: string; draftVersion: number } | ActionFailure;

/**
 * Replaces the Draft with a Published Version's document. The version is
 * untouched, and so is whatever participants are walking. Guarded by
 * `draftVersion`, the Draft version the page last read (ticket 73).
 * Answers the Draft version the restore left, which the acknowledgement of
 * it is cleared past.
 */
export async function restoreVersionAction(
  projectId: string,
  journeyId: string,
  versionId: string,
  draftVersion: unknown,
): Promise<RestoreVersionActionResult> {
  const session = await requireSession();

  const expected = draftVersionSchema.safeParse(draftVersion);
  if (!expected.success) {
    return { ok: false, error: firstIssue(expected.error.issues) };
  }

  // A non-Member, and a version of another Journey, answer like a version
  // that isn't there. A version that fails the document contract (ticket
  // 83) is refused by name: there is nothing in it to copy into the Draft.
  const nouns = { missing: "version", stale: "draft" } as const;
  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return failureResult(notFound(), nouns);

  const restored = await restoreVersion(journey, versionId, expected.data);
  if (!restored.ok) return failureResult(restored, nouns);

  revalidateJourneyPaths();
  return { ok: true, id: journeyId, draftVersion: restored.draftVersion };
}
