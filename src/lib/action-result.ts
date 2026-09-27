import { staleText, type StaleNoun } from "@/lib/autosave";
import type { PublishProblem } from "@/lib/graph/validate";
import type { WriteFailure } from "@/lib/write-result";

/**
 * The shape every dialog-backed server action returns, shared by the Project
 * and Journey actions so the dialogs that render them can never disagree
 * about what a failure looks like. A Project and a Journey are addressed by
 * their id, so a success carries that id: creating and deleting move the
 * browser, and renaming never does.
 */
export type ActionResult = { ok: true; id: string } | ActionFailure;

/**
 * A refused action: the sentence the dialog shows. `stale`: nothing was
 * stored because another Member changed what the write was made against
 * (ticket 73), and `error` is the sentence that says so, for any caller that
 * shows it as it would any refusal. `stepId` names the Step whose rich text
 * was refused, and `problems` every reason a Draft can't be published yet.
 */
export type ActionFailure = {
  ok: false;
  error: string;
  stale?: true;
  stepId?: string;
  problems?: PublishProblem[];
};

/**
 * The one place a data-layer refusal becomes the sentence a Member reads
 * (ticket 82). `missing` names what a `not-found` lost — also the answer to
 * a non-Member, who cannot tell a Project or Journey they may not see from
 * one that never existed — and `stale` what another Member changed, when
 * that is not the same thing (a Journey's Draft, say).
 */
export function failureResult(
  failure: WriteFailure,
  nouns: { missing: "project" | "journey" | "version"; stale?: StaleNoun },
): ActionFailure {
  switch (failure.reason) {
    case "not-found":
      return { ok: false, error: `That ${nouns.missing} no longer exists` };
    case "conflict":
      return {
        ok: false,
        error:
          "Another member published this journey just now. Reload to see their version, then publish again.",
      };
    case "stale":
      return {
        ok: false,
        error: staleText(
          nouns.stale ??
            (nouns.missing === "version" ? "draft" : nouns.missing),
        ),
        stale: true,
      };
    case "invalid": {
      const result: ActionFailure = { ok: false, error: failure.error };
      if (failure.stepId !== undefined) result.stepId = failure.stepId;
      if (failure.problems !== undefined) result.problems = failure.problems;
      return result;
    }
  }
}

/** Surfaces the first schema complaint in the dialog's error slot. */
export function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "That doesn't look right";
}
