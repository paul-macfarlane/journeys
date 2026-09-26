import { staleText, type StaleNoun } from "@/lib/autosave";

/**
 * The shape every dialog-backed server action returns, shared by the Project
 * and Journey actions so the dialogs that render them can never disagree
 * about what a failure looks like. A Project and a Journey are addressed by
 * their id, so a success carries that id: creating and deleting move the
 * browser, and renaming never does.
 */
export type ActionResult =
  | { ok: true; id: string }
  /**
   * `stale`: nothing was stored because another Member changed what the
   * write was made against (ticket 73). `error` is then the sentence that
   * says so, for any caller that shows it as it would any refusal.
   */
  | { ok: false; error: string; stale?: true };

/** A write refused as stale, naming what the other Member changed. */
export function staleResult(noun: StaleNoun): {
  ok: false;
  error: string;
  stale: true;
} {
  return { ok: false, error: staleText(noun), stale: true };
}

/** Surfaces the first schema complaint in the dialog's error slot. */
export function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "That doesn't look right";
}
