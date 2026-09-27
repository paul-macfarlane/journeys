"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { deleteAccount } from "@/db/account";
import { updateAuthorSettings } from "@/db/users";
import { firstIssue, type ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import {
  authorIdentitySchema,
  authorPageSchema,
  authorPageVisibilitySchema,
  deleteAccountSchema,
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

/**
 * Deletes the signed-in Author's account (ticket 77): refuses without the
 * typed email matching the session's own, case-insensitively, before
 * touching the database; otherwise deletes the account in one transaction
 * (`@/db/account`), signs out — the session row is already gone, but this
 * still clears the cookie — and lands on `/` with the notice. `redirect`
 * throws, so it is never called inside a try/catch here.
 */
export async function deleteAccountAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  if (parsed.data.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return { ok: false, error: "Type your account's email to confirm" };
  }

  const result = await deleteAccount(db, session.user.id);
  if (!result.ok) {
    return { ok: false, error: "Your account could not be found" };
  }

  await auth.api.signOut({ headers: await headers() });
  revalidatePath("/projects", "layout");
  redirect("/?notice=account-deleted");
}
