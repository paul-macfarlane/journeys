"use server";

import { revalidatePath } from "next/cache";

import { firstIssue, type ActionResult } from "@/lib/action-result";
import { addMemberByEmail, removeMember } from "@/db/members";
import { createProject, deleteProject, editProject } from "@/db/projects";
import { requireSession } from "@/lib/session";
import { addMemberSchema } from "@/lib/validation/member";
import {
  createProjectSchema,
  editProjectSchema,
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

export async function editProjectAction(
  projectId: string,
  input: unknown,
): Promise<ProjectActionResult> {
  const session = await requireSession();

  const parsed = editProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const renamed = await editProject(projectId, parsed.data, session.user.id);
  // Not a Member (or no such Project): same answer as the page's 404.
  if (!renamed) return { ok: false, error: "That project no longer exists" };

  revalidatePath("/projects");
  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: renamed.id };
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
