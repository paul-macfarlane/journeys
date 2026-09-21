/**
 * The two cookies the participant runner keeps, as names and options only —
 * deliberately no `server-only` and no `cookies()` call here, so the rules
 * can be read (and reasoned about) without dragging in a request context.
 * Only `src/app/j/[journeyId]/actions.ts` ever sets either of them: a page
 * render may read a cookie, never write one.
 *
 * The Run cookie is the Run's only write credential. It holds the Run's id —
 * an unguessable `crypto.randomUUID()` — and it is scoped to one Journey's
 * path, so two Journeys open in one browser keep separate Runs and neither
 * cookie is ever sent to the other. `getRunForJourney` refuses a Run whose
 * Published Version belongs to another Journey, so the path scope is a
 * convenience, not the boundary.
 *
 * The participant cookie holds a pseudonymous id, scoped to `/j` so it is
 * shared across every Journey a Participant walks and never reaches the
 * authoring surface. It is never linked to an account: a Participant is
 * anonymous, by definition.
 */

const DAY_IN_SECONDS = 60 * 60 * 24;

export const PARTICIPANT_COOKIE = "journeys.participant";
export const PARTICIPANT_COOKIE_MAX_AGE = 400 * DAY_IN_SECONDS;
export const RUN_COOKIE_MAX_AGE = 30 * DAY_IN_SECONDS;

/** One Run cookie per Journey, named after the Journey it belongs to. */
export function runCookieName(journeyId: string): string {
  return `journeys.run.${journeyId}`;
}

/** The path that keeps one Journey's Run cookie out of another's requests. */
export function runCookiePath(journeyId: string): string {
  return `/j/${journeyId}`;
}

type CookieOptions = {
  path: string;
  maxAge: number;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
};

/**
 * Read at call time, not at module load: a build and the server that runs it
 * are not guaranteed to see the same environment, and `secure` on a plain
 * http:// development or e2e origin would silently drop every cookie.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function participantCookieOptions(): CookieOptions {
  return {
    path: "/j",
    maxAge: PARTICIPANT_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
  };
}

export function runCookieOptions(journeyId: string): CookieOptions {
  return {
    path: runCookiePath(journeyId),
    maxAge: RUN_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
  };
}
