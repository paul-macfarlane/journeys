// Database access only — `server-only` so a client import fails the build.
import "server-only";

/**
 * The one place a row that fails the document contract is logged (ticket
 * 83). Every site under `src/db` that reads a stored document with
 * `safeParse` calls this on failure instead of throwing: `what` names the
 * kind of row (a Published Version, a Run's path, a Project's description),
 * and `ids` is every id that places it — never the document, and never the
 * zod error's own input, since either can hold what a Participant wrote.
 */
export function logUnreadable(what: string, ids: Record<string, string>): void {
  console.error("[unreadable]", what, ids);
}
