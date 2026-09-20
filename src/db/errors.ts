/**
 * Shared error handling for the tables whose only unique constraint is a
 * slug column — Project and Journey alike, and whatever else adopts the same
 * shape later. `SlugTakenError` is what every write path throws when that
 * constraint refuses a slug; `isUniqueViolation` recognizes Postgres's 23505
 * underneath Drizzle's own wrapper.
 */

export const SLUG_TAKEN_MESSAGE = "That slug is already taken";

/** Raised when a `*_slug_unique` index refuses a slug. */
export class SlugTakenError extends Error {
  constructor() {
    super(SLUG_TAKEN_MESSAGE);
    this.name = "SlugTakenError";
  }
}

/**
 * Postgres unique violation. Drizzle wraps the driver's error in a
 * `DrizzleQueryError`, so the SQLSTATE is on the cause rather than the error
 * itself; the chain is walked (to a bounded depth, so a self-referencing
 * cause can't spin) instead of reaching for a wrapper-specific field.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current != null; depth += 1) {
    if (typeof current !== "object") return false;
    if ("code" in current && (current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}
