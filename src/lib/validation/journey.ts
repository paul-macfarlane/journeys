import { z } from "zod";

import { slugSchema } from "@/lib/slug";

/**
 * Journey input shapes, shared by the client forms and the server actions
 * that back them (deliberately no `server-only`), mirroring
 * `@/lib/validation/project`.
 */

export const journeyTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(120, "Use 120 characters or fewer");

/**
 * A short summary. Empty is allowed (the column defaults to `''`) — the
 * form always sends a string, so there is nothing for a schema-level
 * `.default()` to do, and one would only fight react-hook-form's inferred
 * field type.
 */
export const journeyDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Use 500 characters or fewer");

/** The Author supplies a title and description; the slug is derived. */
export const createJourneySchema = z.object({
  title: journeyTitleSchema,
  description: journeyDescriptionSchema,
});

/**
 * Editing carries the slug too: prefilled with the current one, so a new
 * title or description alone never moves the Journey's URL.
 */
export const updateJourneySchema = z.object({
  title: journeyTitleSchema,
  slug: slugSchema,
  description: journeyDescriptionSchema,
});

export type CreateJourneyInput = z.infer<typeof createJourneySchema>;
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>;
