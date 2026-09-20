"use server";

import { revalidatePath } from "next/cache";

import { firstIssue, type ActionResult } from "@/lib/action-result";
import { saveDraft, validateDraft } from "@/db/drafts";
import { createJourney, deleteJourney, updateJourney } from "@/db/journeys";
import { getProjectForMember } from "@/db/projects";
import { publishDraft, restoreVersion, unpublishJourney } from "@/db/versions";
import type { PublishProblem } from "@/lib/graph/validate";
import { requireSession } from "@/lib/session";
import {
  createJourneySchema,
  updateJourneySchema,
} from "@/lib/validation/journey";

/**
 * Server actions behind the Journey dialogs, mirroring
 * `@/app/projects/actions`.
 *
 * Each one is a public endpoint, so each re-reads the session and re-parses
 * its input rather than trusting the form that called it. They return an
 * `ActionResult` the dialog can render inline.
 */

export type JourneyActionResult = ActionResult;

function revalidateJourneyPaths() {
  revalidatePath("/projects/[projectId]", "page");
  revalidatePath("/projects/[projectId]/journeys/[journeyId]", "page");
}

export async function createJourneyAction(
  projectId: string,
  input: unknown,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const parsed = createJourneySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  // Membership check: an Author who is not a Member of this Project cannot
  // create a Journey inside it.
  const project = await getProjectForMember(projectId, session.user.id);
  if (!project) {
    return { ok: false, error: "That project no longer exists" };
  }

  const created = await createJourney(project.id, parsed.data);
  revalidateJourneyPaths();
  return { ok: true, id: created.id };
}

export async function updateJourneyAction(
  projectId: string,
  journeyId: string,
  input: unknown,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const parsed = updateJourneySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const updated = await updateJourney(
    projectId,
    journeyId,
    parsed.data,
    session.user.id,
  );
  // Not a Member (or no such Journey/Project): same answer as the page's
  // 404.
  if (!updated) return { ok: false, error: "That journey no longer exists" };

  revalidateJourneyPaths();
  return { ok: true, id: updated.id };
}

export async function deleteJourneyAction(
  projectId: string,
  journeyId: string,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const deleted = await deleteJourney(projectId, journeyId, session.user.id);
  if (!deleted) return { ok: false, error: "That journey no longer exists" };

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
}

/**
 * A failed save carries the Step whose rich text was refused when there is
 * one, so the editor can take the Author to it rather than only saying no.
 */
export type SaveDraftActionResult =
  { ok: true; id: string } | { ok: false; error: string; stepId?: string };

/** Stores a Journey's whole Draft document. */
export async function saveDraftAction(
  projectId: string,
  journeyId: string,
  input: unknown,
): Promise<SaveDraftActionResult> {
  const session = await requireSession();

  const saved = await saveDraft(projectId, journeyId, input, session.user.id);
  // Not a Member (or no such Journey/Project): same answer as the page's
  // 404.
  if (!saved) return { ok: false, error: "That journey no longer exists" };
  if (!saved.ok) return { ok: false, error: saved.error, stepId: saved.stepId };

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
}

export type ValidateDraftActionResult =
  { ok: true; problems: PublishProblem[] } | { ok: false; error: string };

/**
 * Publish-time validation of a Journey's Draft as it stands, as something a
 * caller can ask for: an empty problem list means the Draft could be
 * published. Nothing in the UI calls this yet — ticket 08's editor is what
 * will show the problems as an Author works, while `publishJourneyAction`
 * below is what refuses on them.
 */
export async function validateDraftAction(
  projectId: string,
  journeyId: string,
): Promise<ValidateDraftActionResult> {
  const session = await requireSession();

  const problems = await validateDraft(projectId, journeyId, session.user.id);
  if (!problems) return { ok: false, error: "That journey no longer exists" };

  return { ok: true, problems };
}

/**
 * A refused publish carries every problem with the Draft, so an Author sees
 * the whole list rather than the first one.
 */
export type PublishJourneyActionResult =
  | { ok: true; versionNumber: number }
  | { ok: false; error: string; problems?: PublishProblem[] };

/**
 * Publishes a Journey's Draft as its next Published Version. A Draft that
 * fails publish-time validation is refused and nothing is written.
 */
export async function publishJourneyAction(
  projectId: string,
  journeyId: string,
): Promise<PublishJourneyActionResult> {
  const session = await requireSession();

  const published = await publishDraft(projectId, journeyId, session.user.id);
  // Not a Member (or no such Journey/Project): same answer as the page's
  // 404.
  if (!published) return { ok: false, error: "That journey no longer exists" };
  if (!published.ok) {
    return {
      ok: false,
      error: "This journey can't be published yet",
      problems: published.problems,
    };
  }

  revalidateJourneyPaths();
  return { ok: true, versionNumber: published.versionNumber };
}

/** Clears a Journey's live pointer. Every Published Version stays. */
export async function unpublishJourneyAction(
  projectId: string,
  journeyId: string,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const unpublished = await unpublishJourney(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!unpublished) {
    return { ok: false, error: "That journey no longer exists" };
  }

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
}

/**
 * Replaces the Draft with a Published Version's document. The version is
 * untouched, and so is whatever participants are walking.
 */
export async function restoreVersionAction(
  projectId: string,
  journeyId: string,
  versionId: string,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const restored = await restoreVersion(
    projectId,
    journeyId,
    versionId,
    session.user.id,
  );
  // A version of another Journey answers like a Journey that isn't there.
  if (!restored) return { ok: false, error: "That version no longer exists" };

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
}
