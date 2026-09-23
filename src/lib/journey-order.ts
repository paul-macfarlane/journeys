/**
 * The order of a Project's Journeys is the Author's: a `position` on each
 * row, edited one step at a time with "Move up" and "Move down". This is
 * the pure rule behind those two moves, kept database-free so the data
 * layer (which reads the ids in order and writes back what changed) and a
 * unit test share it.
 */

export type MoveDirection = "up" | "down";

/**
 * `ids` with `id` swapped one place in `direction`, as a new array, or null
 * when there is nothing to do: the Journey is already at that end of the
 * list, or is not in it at all. Null lets the caller answer "nothing moved"
 * without a write, and lets stale controls (a Move up clicked after another
 * Member already moved the row to the top) fail quietly.
 */
export function moveInOrder(
  ids: readonly string[],
  id: string,
  direction: MoveDirection,
): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;

  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return null;

  const next = [...ids];
  next[from] = ids[to];
  next[to] = ids[from];
  return next;
}
