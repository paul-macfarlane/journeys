/**
 * The shape every dialog-backed server action returns, shared by the Project
 * and Journey actions so the dialogs that render them can never disagree
 * about what a failure looks like. Navigation stays on the client, which is
 * the side that knows whether it is sitting on a URL a slug just moved out
 * from under; the action only reports the slug it ended up with.
 */
export type ActionResult =
  { ok: true; slug: string } | { ok: false; error: string };

/** Surfaces the first schema complaint in the dialog's error slot. */
export function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "That doesn't look right";
}
