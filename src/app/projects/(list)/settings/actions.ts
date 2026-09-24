"use server";

import { revalidatePath } from "next/cache";

import { updateAuthorSettings } from "@/db/users";
import { firstIssue, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/session";
import {
  authorPageSchema,
  authorPageVisibilitySchema,
  renameAuthorSchema,
} from "@/lib/validation/author";

/**
 * Server actions behind the Settings page (ticket 52): the signed-in
 * Author's display name, their bio and links, and the switch that makes
 * their Author page public. Not better-auth's `updateUser`: the four fields
 * share this one validated path into `@/db/users`.
 *
 * Each one is a public endpoint, so each re-reads the session and re-parses
 * its input rather than trusting the form that called it. An Author only
 * ever edits their own account, so the session's user is the only id used.
 */

/**
 * The name shows in the navbar, on the Projects list, and on every
 * Project's Members tab, so all three are revalidated. The public Author
 * page and Project page are rendered on every request and need nothing.
 */
function revalidateAuthorName(): void {
  revalidatePath("/projects");
  revalidatePath("/projects/settings");
  revalidatePath("/projects/[projectId]", "page");
}

async function saveAuthorSettings(
  userId: string,
  patch: Parameters<typeof updateAuthorSettings>[1],
): Promise<ActionResult> {
  const updated = await updateAuthorSettings(userId, patch);
  if (!updated) return { ok: false, error: "Your account could not be found" };

  revalidateAuthorName();
  return { ok: true, id: userId };
}

export async function renameAuthorAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = renameAuthorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  return saveAuthorSettings(session.user.id, parsed.data);
}

export async function editAuthorPageAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = authorPageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  return saveAuthorSettings(session.user.id, parsed.data);
}

export async function setAuthorPageVisibilityAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = authorPageVisibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  return saveAuthorSettings(session.user.id, parsed.data);
}
