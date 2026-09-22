/**
 * Pure helpers behind the app navbar (ticket 29): what the user menu shows
 * in place of a missing avatar, and which Projects the switcher lists.
 * Database-free so both the server navbar and its client menus can share
 * them and they can be tested in isolation.
 */

/** How many Projects the switcher lists before pointing at the full list. */
export const SWITCHER_LIMIT = 5;

export type SwitcherProject = { id: string; title: string };

/**
 * One or two letters standing in for a missing avatar image: the first
 * letter of the first word and of the last word of the name, upper-cased.
 * A single word gives one letter; a blank name gives "?" rather than an
 * empty circle.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * The Projects the switcher lists: the most recently updated ones, at most
 * `SWITCHER_LIMIT`, with the current Project guaranteed a place. When the
 * current one is not among the recent ones it goes first and the last
 * recent one makes room, so the list never grows past the limit and the
 * page's own Project can always be marked.
 */
export function switcherProjects(
  recent: readonly SwitcherProject[],
  current: SwitcherProject | null,
): SwitcherProject[] {
  const listed = recent.slice(0, SWITCHER_LIMIT);
  if (current === null || listed.some((entry) => entry.id === current.id)) {
    return listed;
  }
  return [current, ...listed.slice(0, SWITCHER_LIMIT - 1)];
}
