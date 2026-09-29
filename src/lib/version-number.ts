/**
 * A Published Version's number as its view's address writes it
 * (`…/versions/<n>`, ticket 94): a positive whole number with no leading
 * zero, no larger than the `integer` column holds. Anything else is no
 * Version at all — null — so the page 404s without asking the database,
 * which would refuse an out-of-range number with an error rather than an
 * empty answer.
 */
const MAX_VERSION_NUMBER = 2_147_483_647;

/**
 * The range half of that rule, for a number that arrives already a number:
 * a Version Preview action's bound argument, which the client controls, so
 * it must be checked before it reaches the database.
 */
export function isVersionNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_VERSION_NUMBER;
}

export function parseVersionNumber(segment: string): number | null {
  if (!/^[1-9]\d*$/.test(segment)) return null;
  const versionNumber = Number(segment);
  return isVersionNumber(versionNumber) ? versionNumber : null;
}
