"use server";

import { revalidatePath } from "next/cache";

import { firstIssue, type ActionResult } from "@/lib/action-result";
import { SlugTakenError } from "@/lib/db-errors";
import { createProject, deleteProject, renameProject } from "@/lib/projects";
import { requireSession } from "@/lib/session";
import {
  createProjectSchema,
  renameProjectSchema,
} from "@/lib/validation/project";

/**
 * Server actions behind the Project dialogs.
 *
 * Each one is a public endpoint, so each re-reads the session and re-parses
 * its input rather than trusting the form that called it. They return an
 * `ActionResult` the dialog can render inline.
 */

export type ProjectActionResult = ActionResult;

export async function createProjectAction(
  input: unknown,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  try {
    const created = await createProject(parsed.data, session.user.id);
    revalidatePath("/projects");
    return { ok: true, slug: created.slug };
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function renameProjectAction(
  currentSlug: string,
  input: unknown,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const parsed = renameProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  try {
    const renamed = await renameProject(
      currentSlug,
      parsed.data,
      session.user.id,
    );
    // Not a Member (or no such Project): same answer as the page's 404.
    if (!renamed) return { ok: false, error: "That project no longer exists" };

    revalidatePath("/projects");
    revalidatePath("/projects/[projectSlug]", "page");
    return { ok: true, slug: renamed.slug };
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function deleteProjectAction(
  slug: string,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const deleted = await deleteProject(slug, session.user.id);
  if (!deleted) return { ok: false, error: "That project no longer exists" };

  revalidatePath("/projects");
  revalidatePath("/projects/[projectSlug]", "page");
  return { ok: true, slug };
}
