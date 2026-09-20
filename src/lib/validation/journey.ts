import { z } from "zod";

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

/** The Author supplies a title and description; the id is the address. */
export const createJourneySchema = z.object({
  title: journeyTitleSchema,
  description: journeyDescriptionSchema,
});

/** Title and description are the whole of a Journey's metadata. */
export const updateJourneySchema = z.object({
  title: journeyTitleSchema,
  description: journeyDescriptionSchema,
});

export type CreateJourneyInput = z.infer<typeof createJourneySchema>;
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>;
