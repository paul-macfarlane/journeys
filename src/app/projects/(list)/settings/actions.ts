"use server";

import { revalidatePath } from "next/cache";

import { updateAuthorSettings } from "@/db/users";
import { firstIssue, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/session";
import {
  authorIdentitySchema,
  authorPageSchema,
  authorPageVisibilitySchema,
} from "@/lib/validation/author";

/**
 * Server actions behind the Settings page (ticket 52): the signed-in
 * Author's display name and profile picture, their bio and links, and the
 * switch that makes their Author page public. Not better-auth's `updateUser`:
 * every field shares this one validated path into `@/db/users`.
 *
 * Each one is a public endpoint, so each re-reads the session and re-parses
 * its input rather than trusting the form that called it. An Author only
 * ever edits their own account, so the session's user is the only id used.
 */

/**
 * The name shows in the navbar, on the Projects list, and on every
 * Project's Members tab — everything under `/projects`, navbar layouts and
 * Journey pages included — so the whole `/projects` layout is revalidated.
 * The public Author page and Project page are rendered on every request
 * and need nothing.
 */
function revalidateAuthorName(): void {
  revalidatePath("/projects", "layout");
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

export async function editAuthorIdentityAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = authorIdentitySchema.safeParse(input);
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
