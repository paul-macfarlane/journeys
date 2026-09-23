"use server";

import { revalidatePath } from "next/cache";

import { firstIssue, type ActionResult } from "@/lib/action-result";
import { addMemberByEmail, removeMember } from "@/db/members";
import {
  createProject,
  deleteProject,
  editProjectDescription,
  renameProject,
  setProjectTheme,
} from "@/db/projects";
import { sanitizeContent } from "@/lib/graph/content";
import { requireSession } from "@/lib/session";
import { addMemberSchema } from "@/lib/validation/member";
import {
  createProjectSchema,
  projectThemeSchema,
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

  const created = await createProject(parsed.data, session.user.id);
  revalidatePath("/projects");
  return { ok: true, id: created.id };
}

export async function renameProjectAction(
  projectId: string,
  input: unknown,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const parsed = renameProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const renamed = await renameProject(projectId, parsed.data, session.user.id);
  // Not a Member (or no such Project): same answer as the page's 404.
  if (!renamed) return { ok: false, error: "That project no longer exists" };

  revalidatePath("/projects");
  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: renamed.id };
}

/**
 * Replaces the Project's rich-text description. The editor already cleaned
 * what it sends, but the action is a public endpoint, so the content goes
 * through `sanitizeContent` again here — the same closed set a Step's text
 * is held to — before anything reaches storage. The public Project page is
 * rendered on every request, so it needs no revalidation.
 */
export async function editProjectDescriptionAction(
  projectId: string,
  input: unknown,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const sanitized = sanitizeContent(input);
  if (!sanitized.ok) {
    return { ok: false, error: sanitized.error };
  }

  const edited = await editProjectDescription(
    projectId,
    sanitized.content,
    session.user.id,
  );
  if (!edited) return { ok: false, error: "That project no longer exists" };

  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: edited.id };
}

/**
 * Sets the Project's Theme (ticket 11): the preset and the optional accent
 * the runner and the public Project page are painted in. Both are rendered
 * on every request, so neither needs revalidating; the Settings tab does.
 */
export async function setProjectThemeAction(
  projectId: string,
  input: unknown,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const parsed = projectThemeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const updated = await setProjectTheme(
    projectId,
    parsed.data,
    session.user.id,
  );
  if (!updated) return { ok: false, error: "That project no longer exists" };

  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: updated.id };
}

export async function deleteProjectAction(
  projectId: string,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const deleted = await deleteProject(projectId, session.user.id);
  if (!deleted) return { ok: false, error: "That project no longer exists" };

  revalidatePath("/projects");
  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: projectId };
}

const addMemberErrors = {
  "no-project": "That project no longer exists",
  "unknown-email": "No account has that email — they need to sign up first",
  "already-member": "Already a member of this project",
} as const;

export async function addMemberAction(
  projectId: string,
  input: unknown,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const result = await addMemberByEmail(
    projectId,
    parsed.data.email,
    session.user.id,
  );
  if (!result.ok) {
    return { ok: false, error: addMemberErrors[result.reason] };
  }

  revalidatePath("/projects");
  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: result.userId };
}

const removeMemberErrors = {
  "no-project": "That project no longer exists",
  "not-a-member": "That member has already been removed",
  "last-member": "A project must keep at least one member",
} as const;

export async function removeMemberAction(
  projectId: string,
  userId: string,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const result = await removeMember(projectId, userId, session.user.id);
  if (!result.ok) {
    return { ok: false, error: removeMemberErrors[result.reason] };
  }

  revalidatePath("/projects");
  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: userId };
}
