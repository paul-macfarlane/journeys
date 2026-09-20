/**
 * The seed's command line.
 *
 * Exactly one positional argument — the Author's email — and the single
 * optional `--write-fixture` flag. Anything else is a usage error rather than
 * a guess: a mistyped `--write-fixtures` must not quietly seed without
 * rewriting the fixture, and a second email must not silently pick one.
 */

export const USAGE = "Usage: pnpm seed:case-3 <author-email> [--write-fixture]";

export type Arguments = { email: string; writeFixture: boolean };

/** `null` means the caller should print `USAGE` and exit 2. */
export function readArguments(argv: string[]): Arguments | null {
  const positional: string[] = [];
  let writeFixture = false;

  for (const argument of argv) {
    if (argument === "--write-fixture") {
      writeFixture = true;
      continue;
    }
    if (argument.startsWith("-")) return null;
    positional.push(argument);
  }

  if (positional.length !== 1 || positional[0].length === 0) return null;
  return { email: positional[0], writeFixture };
}
