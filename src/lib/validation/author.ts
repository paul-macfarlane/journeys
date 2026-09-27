import { z } from "zod";

import {
  authorBioSchema,
  authorImageSchema,
  authorLinksSchema,
  authorNameSchema,
  authorPublicSchema,
} from "@/lib/author";

/**
 * The Settings page's three edits (ticket 52), shared by the client form and
 * the server actions that back them (deliberately no `server-only`, like
 * `validation/project.ts`): one schema per field group, so the form and the
 * action can never disagree about what a valid edit is. The rules
 * themselves live in `@/lib/author`, which the public page reads too.
 */

/**
 * The "Display name" section: the name, and the profile picture as a link
 * (blank for the initials), saved together as one record.
 */
export const authorIdentitySchema = z.object({
  name: authorNameSchema,
  image: authorImageSchema,
});

/** The bio and links, saved together from the "Author page" section. */
export const authorPageSchema = z.object({
  bio: authorBioSchema,
  links: authorLinksSchema,
});

/** The public switch, applied as soon as it is flipped. */
export const authorPageVisibilitySchema = z.object({
  public: authorPublicSchema,
});

/**
 * The "Delete account" confirmation (ticket 77): the typed email, compared
 * to the session's own case-insensitively by the action, before anything is
 * deleted.
 */
export const deleteAccountSchema = z.object({
  email: z.string().trim(),
});

export type AuthorIdentityInput = z.infer<typeof authorIdentitySchema>;
