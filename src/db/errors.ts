// Server-only data-layer helper — `server-only` so a client import fails the build.
import "server-only";

/**
 * The SQLSTATE of a failed statement. drizzle-orm wraps the driver's error
 * as a `DrizzleQueryError` whose `cause` is the `pg` `DatabaseError`, so the
 * code lives on the cause; the error itself is checked too in case a caller
 * ever sees the driver error unwrapped.
 */
export function pgErrorCode(error: unknown): string | undefined {
  const candidates = [error instanceof Error ? error.cause : undefined, error];
  for (const candidate of candidates) {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      typeof candidate.code === "string"
    ) {
      return candidate.code;
    }
  }
  return undefined;
}

/** 23505: unique_violation. */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === "23505";
}
