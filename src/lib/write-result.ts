import type { PublishProblem } from "@/lib/graph/validate";

/**
 * The one shape every refused data-layer write answers with (ticket 82).
 * Deliberately no `server-only`: `src/db` returns it and the action layer
 * maps it to a sentence (`failureResult` in `@/lib/action-result`), so both
 * sides import it and neither owns it.
 *
 * - `not-found`: the row the write names is not there — deleted by another
 *   Member, or never there. A non-Member never reaches a write: membership
 *   is resolved first, by `@/db/access`, and answered the same way.
 * - `conflict`: two Members published one Journey at the same moment, and
 *   the other one's version took the number.
 * - `stale`: another Member changed what the write was made against (ticket
 *   73), so nothing was stored.
 * - `invalid`: the value itself was refused — a document or field the
 *   contract turns away — with the sentence that says why, and the Step or
 *   the publish problems it concerns when there are any.
 */
export type WriteFailure =
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "conflict" }
  | { ok: false; reason: "stale" }
  | {
      ok: false;
      reason: "invalid";
      error: string;
      stepId?: string;
      problems?: PublishProblem[];
    };

export function notFound(): Extract<WriteFailure, { reason: "not-found" }> {
  return { ok: false, reason: "not-found" };
}

export function conflict(): Extract<WriteFailure, { reason: "conflict" }> {
  return { ok: false, reason: "conflict" };
}

export function stale(): Extract<WriteFailure, { reason: "stale" }> {
  return { ok: false, reason: "stale" };
}

export function invalid(
  error: string,
  extra: { stepId?: string; problems?: PublishProblem[] } = {},
): Extract<WriteFailure, { reason: "invalid" }> {
  return { ok: false, reason: "invalid", error, ...extra };
}
