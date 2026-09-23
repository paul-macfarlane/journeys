/**
 * The judge's rate limit (ticket 43): one decision per key — a Run, a
 * Participant, an Author — per window. Pure and database-free: the caller
 * owns the map and the clock, so a test drives both. A refused decision is
 * never an error; the action reads it as "no answer" and shows the Choices,
 * so a Run is never stuck behind the limit.
 */

/**
 * Past this many keys, entries whose window has passed are dropped, so a
 * long-lived server does not keep one timestamp per Run it ever judged.
 */
const PRUNE_AT = 10_000;

/**
 * True when `key` may be judged at `now`, and records `now` as its last
 * decision; false when its last decision was less than `windowMs` ago. A
 * refused call records nothing, so it does not push the window out.
 */
export function decisionAllowed(
  lastDecisionAt: Map<string, number>,
  key: string,
  now: number,
  windowMs: number,
): boolean {
  const last = lastDecisionAt.get(key);
  if (last !== undefined && now - last < windowMs) return false;

  lastDecisionAt.set(key, now);

  if (lastDecisionAt.size > PRUNE_AT) {
    for (const [staleKey, at] of lastDecisionAt) {
      if (now - at >= windowMs) lastDecisionAt.delete(staleKey);
    }
  }

  return true;
}
