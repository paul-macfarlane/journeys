// Database access only — `server-only` so a client import fails the build.
import "server-only";

import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * The one conditional write every concurrently edited row goes through
 * (ticket 73; ADR-0001, amended). A Member's write names what it was made
 * against, and is stored only while the row still holds that: a Draft by
 * its `version` counter, a Project's or a Journey's settings by the previous
 * value of each field the write changes. Otherwise it is refused as stale,
 * never merged and never overwritten.
 */

/** A write refused because another Member changed what it was made against. */
export type StaleWrite = { ok: false; reason: "stale" };

export type GuardedWriteResult<R> =
  { ok: true; row: R } | StaleWrite | { ok: false; reason: "not-found" };

/**
 * Runs `write` — an UPDATE, or an upsert whose conflict branch is guarded,
 * with RETURNING — and reads what it answered. A row is the write. No row is
 * ambiguous: the guard failed, or the row went away between the caller's
 * membership check and the write (a Journey deleted in that moment). `exists`
 * re-reads the row to tell the two apart, so a deleted row is never reported
 * to the Member as someone else's change.
 */
export async function guardedWrite<R>(
  write: () => Promise<R[]>,
  exists: () => Promise<boolean>,
): Promise<GuardedWriteResult<R>> {
  const [row] = await write();
  if (row !== undefined) return { ok: true, row };
  return (await exists())
    ? { ok: false, reason: "stale" }
    : { ok: false, reason: "not-found" };
}

/** Whether a data-layer answer is a stale refusal. */
export function isStale(result: unknown): result is StaleWrite {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { reason?: unknown }).reason === "stale"
  );
}

/** Two stored values are the same: rich text by what it holds. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The fields a settings write changes: the ones whose value differs from the
 * baseline the Member edited against. Only these are written, and only these
 * are guarded, so an untouched field is never overwritten or checked — the
 * three loops on one Project row, and publish or move on a Journey row, never
 * make each other stale.
 */
export function changedFields<T extends Record<string, unknown>>(
  next: T,
  baseline: T,
): (keyof T & string)[] {
  return (Object.keys(next) as (keyof T & string)[]).filter(
    (key) => !sameValue(next[key], baseline[key]),
  );
}

/**
 * `column IS NOT DISTINCT FROM previous`: the compare-previous-value guard on
 * one field, null-safe, jsonb compared as jsonb.
 */
export function stillHolds(column: PgColumn, previous: unknown): SQL {
  if (column.columnType === "PgJsonb") {
    return sql`${column} IS NOT DISTINCT FROM ${JSON.stringify(previous)}::jsonb`;
  }
  return sql`${column} IS NOT DISTINCT FROM ${previous}`;
}
