/**
 * The fixed ids the seed writes under, so rerunning it updates the same rows
 * instead of adding more. Exported rather than inlined because the e2e spec
 * proves exactly one of each exists and has to name them too.
 *
 * They are UUID-shaped like every other Project and Journey id, with a
 * recognisable `5eed` group so a row found in a database is obviously seeded.
 */

export const SEED_PROJECT_ID = "00000000-5eed-4000-8000-000000000001";
export const SEED_PROJECT_TITLE = "Journey Stories";

export const SEED_JOURNEY_ID = "00000000-5eed-4000-8000-000000000003";
export const SEED_JOURNEY_TITLE = "Case 3";

/** The blurb the legacy site's listing gives case 3. */
export const SEED_JOURNEY_DESCRIPTION =
  "Goal: Maintain your health condition to the best of your ability before it manifests as serious complications.";
