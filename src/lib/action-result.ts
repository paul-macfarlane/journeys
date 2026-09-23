/**
 * The shape every dialog-backed server action returns, shared by the Project
 * and Journey actions so the dialogs that render them can never disagree
 * about what a failure looks like. A Project and a Journey are addressed by
 * their id, so a success carries that id: creating and deleting move the
 * browser, and renaming never does.
 */
export type ActionResult =
  { ok: true; id: string } | { ok: false; error: string };

/** Surfaces the first schema complaint in the dialog's error slot. */
export function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "That doesn't look right";
}
