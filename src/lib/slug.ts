import { z } from "zod";

/**
 * Slugs for Projects and Journeys. Shared by client and server (no
 * `server-only`): the create and rename forms preview and validate a slug
 * before the server action ever runs.
 */

/** Long enough for a real title, short enough to stay a readable URL. */
export const MAX_SLUG_LENGTH = 60;

/** Lowercase alphanumeric words joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Used when a title has no alphanumerics at all (e.g. "!!!"). */
const SLUG_FALLBACK = "untitled";

/**
 * Derives a slug from a title: decomposed to strip diacritics (so "Café"
 * keeps its letters rather than losing them), lowercased, every other run of
 * characters folded to a single hyphen, capped at `MAX_SLUG_LENGTH` with no
 * hyphen left dangling at either end.
 */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    // Combining marks left behind by the decomposition above.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    // The cap can land mid-word and leave the hyphen before it.
    .replace(/-+$/, "");

  return slug === "" ? SLUG_FALLBACK : slug;
}

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Enter a slug")
  .max(MAX_SLUG_LENGTH, `Use ${MAX_SLUG_LENGTH} characters or fewer`)
  .regex(
    SLUG_PATTERN,
    "Use lowercase letters, numbers, and single hyphens between them",
  );

/** Enough attempts that only a pathological title runs out. */
const MAX_UNIQUE_SLUG_ATTEMPTS = 100;

function withSuffix(base: string, attempt: number): string {
  const suffix = `-${attempt}`;
  return (
    base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, "") + suffix
  );
}

/**
 * The first free slug in the series `base`, `base-2`, `base-3`, … Pure apart
 * from the caller's `isTaken`, which is the only thing that touches the
 * database. Slugs are globally unique, so the unique index — not this — is
 * the real guard; this just keeps auto-generated slugs from colliding in the
 * common case.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean> | boolean,
): Promise<string> {
  if (!(await isTaken(base))) return base;

  for (let attempt = 2; attempt <= MAX_UNIQUE_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = withSuffix(base, attempt);
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`uniqueSlug: no free slug found for "${base}"`);
}
