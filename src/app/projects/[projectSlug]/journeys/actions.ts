"use server";

import { revalidatePath } from "next/cache";

import { getProjectForMember } from "@/lib/projects";
import { SlugTakenError } from "@/lib/db-errors";
import { createJourney, deleteJourney, updateJourney } from "@/lib/journeys";
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
 * its input rather than trusting the form that called it. They return a
 * result the dialog can render inline; navigation stays on the client, which
 * is the side that knows whether it is sitting on a URL the slug just moved
 * out from under.
 */

export type JourneyActionResult =
  { ok: true; slug: string } | { ok: false; error: string };

/** Surfaces the first schema complaint in the dialog's error slot. */
function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "That doesn't look right";
}

function revalidateJourneyPaths() {
  revalidatePath("/projects/[projectSlug]", "page");
  revalidatePath("/projects/[projectSlug]/journeys/[journeySlug]", "page");
}

export async function createJourneyAction(
  projectSlug: string,
  input: unknown,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const parsed = createJourneySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  // Membership check: an Author who is not a Member of this Project cannot
  // create a Journey inside it.
  const project = await getProjectForMember(projectSlug, session.user.id);
  if (!project) {
    return { ok: false, error: "That project no longer exists" };
  }

  try {
    const created = await createJourney(project.id, parsed.data);
    revalidateJourneyPaths();
    return { ok: true, slug: created.slug };
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function updateJourneyAction(
  projectSlug: string,
  journeySlug: string,
  input: unknown,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const parsed = updateJourneySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  try {
    const updated = await updateJourney(
      projectSlug,
      journeySlug,
      parsed.data,
      session.user.id,
    );
    // Not a Member (or no such Journey/Project): same answer as the page's
    // 404.
    if (!updated) return { ok: false, error: "That journey no longer exists" };

    revalidateJourneyPaths();
    return { ok: true, slug: updated.slug };
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function deleteJourneyAction(
  projectSlug: string,
  journeySlug: string,
): Promise<JourneyActionResult> {
  const session = await requireSession();

  const deleted = await deleteJourney(
    projectSlug,
    journeySlug,
    session.user.id,
  );
  if (!deleted) return { ok: false, error: "That journey no longer exists" };

  revalidateJourneyPaths();
  return { ok: true, slug: journeySlug };
}
