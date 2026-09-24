/**
 * The Journey Stories seed's fixed ids. The seed script writes these rows and
 * the public pages link to them: the ids are the same on every environment
 * that ran `pnpm seed:journey-stories`, so the "Play a Journey" link needs no
 * configuration. On an environment that never ran the seed the link 404s,
 * which is accepted (ticket 54).
 */
export const SEED_PROJECT_ID = "00000000-5eed-4000-8000-000000000001";

export const SEED_JOURNEY_IDS = {
  case1: "00000000-5eed-4000-8000-000000000011",
  case2: "00000000-5eed-4000-8000-000000000012",
  case3: "00000000-5eed-4000-8000-000000000013",
} as const;

/** The anonymous, public page that lists the seed Project's Journeys. */
export const PLAY_JOURNEY_HREF = `/p/${SEED_PROJECT_ID}`;
export const PLAY_JOURNEY_LABEL = "Play a Journey — no account needed";
