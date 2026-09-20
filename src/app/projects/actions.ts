"use server";

import { revalidatePath } from "next/cache";

import {
  createProject,
  deleteProject,
  renameProject,
  SlugTakenError,
} from "@/lib/projects";
import { requireSession } from "@/lib/session";
import {
  createProjectSchema,
  renameProjectSchema,
} from "@/lib/validation/project";

/**
 * Server actions behind the Project dialogs.
 *
 * Each one is a public endpoint, so each re-reads the session and re-parses
 * its input rather than trusting the form that called it. They return a
 * result the dialog can render inline; navigation stays on the client, which
 * is the side that knows whether it is sitting on a URL the slug just moved
 * out from under.
 */

export type ProjectActionResult =
  { ok: true; slug: string } | { ok: false; error: string };

/** Surfaces the first schema complaint in the dialog's error slot. */
function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "That doesn't look right";
}

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
