"use server";

import { revalidatePath } from "next/cache";

import {
  firstIssue,
  staleResult,
  type ActionResult,
} from "@/lib/action-result";
import { saveDraft } from "@/db/drafts";
import { isStale } from "@/db/guarded-write";
import {
  createJourney,
  deleteJourney,
  moveJourney,
  setJourneyTheme,
  updateJourney,
} from "@/db/journeys";
import { getProjectForMember } from "@/db/projects";
import {
  isUnreadableVersion,
  publishDraft,
  restoreVersion,
  unpublishJourney,
} from "@/db/versions";
import { env } from "@/lib/env";
import { isDeciding } from "@/lib/graph/prompt";
import type { PublishProblem } from "@/lib/graph/validate";
import { requireSession } from "@/lib/session";
import {
  createJourneySchema,
  draftVersionSchema,
  journeyThemeSchema,
  moveDirectionSchema,
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
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const parsed = updateJourneySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const previous = updateJourneySchema.safeParse(baseline);
  if (!previous.success) {
    return { ok: false, error: firstIssue(previous.error.issues) };
  }

  const updated = await updateJourney(
    projectId,
    journeyId,
    parsed.data,
    previous.data,
    session.user.id,
  );
  // Not a Member (or no such Journey/Project): same answer as the page's
  // 404.
  if (!updated) return { ok: false, error: "That journey no longer exists" };
  if (isStale(updated)) return staleResult("journey");

  revalidateJourneyPaths();
  return { ok: true, id: updated.id };
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
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const parsed = journeyThemeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const previous = journeyThemeSchema.safeParse(baseline);
  if (!previous.success) {
    return { ok: false, error: firstIssue(previous.error.issues) };
  }

  const updated = await setJourneyTheme(
    projectId,
    journeyId,
    parsed.data,
    previous.data,
    session.user.id,
  );
  if (!updated) return { ok: false, error: "That journey no longer exists" };
  if (isStale(updated)) return staleResult("journey");

  revalidateJourneyPaths();
  return { ok: true, id: updated.id };
}

/**
 * Moves a Journey one place up or down in its Project's list. Nothing
 * happens off either end, so a stale control is harmless.
 */
export async function moveJourneyAction(
  projectId: string,
  journeyId: string,
  input: unknown,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const parsed = moveDirectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const moved = await moveJourney(
    projectId,
    journeyId,
    parsed.data,
    session.user.id,
  );
  if (!moved) return { ok: false, error: "That journey no longer exists" };

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
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
 * A saved Draft carries its new version, which the editor's next save is
 * guarded by. A failed save carries the Step whose rich text was refused
 * when there is one, so the editor can take the Author to it rather than
 * only saying no; a stale one says another Member saved first (ticket 73).
 */
export type SaveDraftActionResult =
  | { ok: true; id: string; version: number }
  | { ok: false; error: string; stepId?: string; stale?: true };

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

  const saved = await saveDraft(
    projectId,
    journeyId,
    input,
    expected.data,
    session.user.id,
  );
  // Not a Member (or no such Journey/Project): same answer as the page's
  // 404.
  if (!saved) return { ok: false, error: "That journey no longer exists" };
  if (isStale(saved)) return staleResult("draft");
  if (!saved.ok) return { ok: false, error: saved.error, stepId: saved.stepId };

  revalidateJourneyPaths();
  return { ok: true, id: journeyId, version: saved.version };
}

/**
 * A refused publish carries every problem with the Draft, so an Author sees
 * the whole list rather than the first one.
 */
export type PublishJourneyActionResult =
  | { ok: true; versionNumber: number; warning?: string }
  | {
      ok: false;
      error: string;
      problems?: PublishProblem[];
      stale?: true;
    };

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

  const published = await publishDraft(
    projectId,
    journeyId,
    expected.data,
    session.user.id,
  );
  // Not a Member (or no such Journey/Project): same answer as the page's
  // 404.
  if (!published) return { ok: false, error: "That journey no longer exists" };
  if (isStale(published)) return staleResult("draft");
  if (!published.ok) {
    if ("unreadable" in published) {
      return {
        ok: false,
        error:
          "This journey's draft can't be read. Restore it from a published version before publishing.",
      };
    }
    if ("conflict" in published) {
      return {
        ok: false,
        error:
          "Another member published this journey just now. Reload to see their version, then publish again.",
      };
    }
    return {
      ok: false,
      error: "This journey can't be published yet",
      problems: published.problems,
    };
  }

  revalidateJourneyPaths();

  // A deciding Prompt (ticket 43) with no gateway key still publishes — the
  // runner falls back to the Choices — but the Author is told, once, here.
  const decides = Object.values(published.document.steps).some(isDeciding);
  if (decides && env.AI_GATEWAY_API_KEY === undefined) {
    return {
      ok: true,
      versionNumber: published.versionNumber,
      warning:
        "This journey has a prompt that decides the next step, but no AI Gateway key is set. Participants will choose for themselves.",
    };
  }

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
 * untouched, and so is whatever participants are walking. Guarded by
 * `draftVersion`, the Draft version the page last read (ticket 73).
 */
export async function restoreVersionAction(
  projectId: string,
  journeyId: string,
  versionId: string,
  draftVersion: unknown,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const expected = draftVersionSchema.safeParse(draftVersion);
  if (!expected.success) {
    return { ok: false, error: firstIssue(expected.error.issues) };
  }

  const restored = await restoreVersion(
    projectId,
    journeyId,
    versionId,
    expected.data,
    session.user.id,
  );
  // A version of another Journey answers like a Journey that isn't there.
  if (!restored) return { ok: false, error: "That version no longer exists" };
  if (isStale(restored)) return staleResult("draft");
  // The version being restored fails the document contract (ticket 83):
  // there is nothing in it to copy into the Draft.
  if (isUnreadableVersion(restored)) {
    return {
      ok: false,
      error: `Version ${restored.versionNumber} can't be read, so it can't be restored.`,
    };
  }

  revalidateJourneyPaths();
  return { ok: true, id: journeyId };
}
