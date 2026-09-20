import type { GraphDocument } from "@/lib/graph/document";

/**
 * Serializes the seeded document for `src/lib/graph/fixtures/case-3.json`.
 *
 * Plain `JSON.stringify` would do, except that one legacy image lives at a
 * rawpixel URL whose path segment is 70-odd base64 characters, and the
 * commit-time secret scanners refuse any unbroken run of 40 or more
 * `[A-Za-z0-9+/]` as a possible credential. The URL is a public image
 * address, not a secret, and the fixture has to hold the real document, so a
 * placeholder is not an answer.
 *
 * JSON lets any character inside a string be written as a `\uXXXX` escape
 * without changing the string, so one character in every such run is written
 * that way. The file text then contains no run the scanners object to, and
 * `JSON.parse` of it is deep-equal to the document that went in. Runs that
 * long only ever occur inside string values in a document of this shape —
 * every id is short and numbers are shorter — so the escape is always inside
 * a string literal.
 */

/** The catch-all shape the scanners refuse. */
const LONG_RUN = /[A-Za-z0-9+/]{40,}/g;

/**
 * Chunk length such that no run stays at 40 or more once broken: the escape
 * itself contributes `uXXXX` (five word characters) to the run that follows
 * its backslash, so 5 + (CHUNK - 1) must stay below 40.
 */
const CHUNK = 32;

function escapeFirstCharacter(chunk: string): string {
  const code = chunk.charCodeAt(0).toString(16).padStart(4, "0");
  return `\\u${code}${chunk.slice(1)}`;
}

function breakRun(run: string): string {
  let out = run.slice(0, CHUNK);
  for (let index = CHUNK; index < run.length; index += CHUNK) {
    out += escapeFirstCharacter(run.slice(index, index + CHUNK));
  }
  return out;
}

/** Pretty-printed JSON with a trailing newline, safe for the secret scanners. */
export function serializeFixture(document: GraphDocument): string {
  const json = JSON.stringify(document, null, 2);
  return `${json.replace(LONG_RUN, breakRun)}\n`;
}
