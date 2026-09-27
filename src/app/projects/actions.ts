"use server";

import { revalidatePath } from "next/cache";

import {
  failureResult,
  firstIssue,
  type ActionResult,
} from "@/lib/action-result";
import { projectForMember } from "@/db/access";
import { addMemberByEmail, removeMember } from "@/db/members";
import {
  createProject,
  deleteProject,
  editProjectDescription,
  renameProject,
  setProjectTheme,
} from "@/db/projects";
import { requireSession } from "@/lib/session";
import { addMemberSchema } from "@/lib/validation/member";
import {
  createProjectSchema,
  projectThemeSchema,
  renameProjectSchema,
} from "@/lib/validation/project";
import { notFound } from "@/lib/write-result";

/**
 * Server actions behind the Project dialogs.
 *
 * Each one is a public endpoint, so each re-reads the session and re-parses
 * its input rather than trusting the form that called it, and resolves the
 * Project through the membership seam (`projectForMember`) before the data
 * layer is asked anything. They return an `ActionResult` the dialog can
 * render inline.
 */

/** The Project list and the Project page, after a change both show. */
function revalidateProjectPaths() {
  revalidatePath("/projects");
  revalidatePath("/projects/[projectId]", "page");
}

/** A non-Member, or no such Project: the same answer as the page's 404. */
const noProject = () => failureResult(notFound(), { missing: "project" });

export async function createProjectAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const created = await createProject(parsed.data, session.user.id);
  revalidatePath("/projects");
  return { ok: true, id: created.id };
}

/**
 * Renames the Project. `baseline` is the title the Member edited from,
 * parsed by the same schema as the title: another Member's rename since is
 * refused as stale rather than overwritten (ticket 73).
 */
export async function renameProjectAction(
  projectId: string,
  input: unknown,
  baseline: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = renameProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const previous = renameProjectSchema.safeParse(baseline);
  if (!previous.success) {
    return { ok: false, error: firstIssue(previous.error.issues) };
  }

  const project = await projectForMember(projectId, session.user.id);
  if (!project) return noProject();

  const renamed = await renameProject(project, parsed.data, previous.data);
  if (!renamed.ok) return failureResult(renamed, { missing: "project" });

  revalidateProjectPaths();
  return { ok: true, id: renamed.project.id };
}

/**
 * Replaces the Project's rich-text description. The editor already cleaned
 * what it sends, but the action is a public endpoint, so the data layer
 * cleans the content again (`editProjectDescription`, the one path that
 * accepts a description) — and the baseline, the description the Member
 * edited from, which guards the write (ticket 73). The public Project page
 * is rendered on every request, so it needs no revalidation.
 */
export async function editProjectDescriptionAction(
  projectId: string,
  input: unknown,
  baseline: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const project = await projectForMember(projectId, session.user.id);
  if (!project) return noProject();

  const edited = await editProjectDescription(project, input, baseline);
  if (!edited.ok) return failureResult(edited, { missing: "project" });

  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: edited.project.id };
}

/**
 * Sets the Project's Theme (ticket 11): the preset and the optional accent
 * the runner and the public Project page are painted in. Both are rendered
 * on every request, so neither needs revalidating; the Settings tab does.
 * `baseline` is the Theme the Member edited from, parsed the same way.
 */
export async function setProjectThemeAction(
  projectId: string,
  input: unknown,
  baseline: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = projectThemeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const previous = projectThemeSchema.safeParse(baseline);
  if (!previous.success) {
    return { ok: false, error: firstIssue(previous.error.issues) };
  }

  const project = await projectForMember(projectId, session.user.id);
  if (!project) return noProject();

  const updated = await setProjectTheme(project, parsed.data, previous.data);
  if (!updated.ok) return failureResult(updated, { missing: "project" });

  revalidatePath("/projects/[projectId]", "page");
  return { ok: true, id: updated.project.id };
}

export async function deleteProjectAction(
  projectId: string,
): Promise<ActionResult> {
  const session = await requireSession();

  const project = await projectForMember(projectId, session.user.id);
  if (!project) return noProject();

  await deleteProject(project);

  revalidateProjectPaths();
  return { ok: true, id: projectId };
}

const addMemberErrors = {
  "unknown-email": "No account has that email — they need to sign up first",
  "already-member": "Already a member of this project",
} as const;

export async function addMemberAction(
  projectId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  const project = await projectForMember(projectId, session.user.id);
  if (!project) return noProject();

  const result = await addMemberByEmail(project, parsed.data.email);
  if (!result.ok) {
    return { ok: false, error: addMemberErrors[result.reason] };
  }

  revalidateProjectPaths();
  return { ok: true, id: result.userId };
}

const removeMemberErrors = {
  "not-a-member": "That member has already been removed",
  "last-member": "A project must keep at least one member",
} as const;

export async function removeMemberAction(
  projectId: string,
  userId: string,
): Promise<ActionResult> {
  const session = await requireSession();

  const project = await projectForMember(projectId, session.user.id);
  if (!project) return noProject();

  const result = await removeMember(project, userId);
  if (!result.ok) {
    return result.reason === "not-found"
      ? noProject()
      : { ok: false, error: removeMemberErrors[result.reason] };
  }

  revalidateProjectPaths();
  return { ok: true, id: userId };
}
