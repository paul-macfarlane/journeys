import { z } from "zod";

import { accentColorSchema, themePresetSchema } from "@/lib/theme";

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

/**
 * The Author supplies a title; the id is the address. The description is
 * edited on the Journey page the Author lands on (ticket 47), so the dialog
 * no longer sends one: it defaults to empty here so the action still hands
 * `createJourney` a string.
 */
export const createJourneySchema = z.object({
  title: journeyTitleSchema,
  description: journeyDescriptionSchema.default(""),
});

/** Title and description are the whole of a Journey's metadata. */
export const updateJourneySchema = z.object({
  title: journeyTitleSchema,
  description: journeyDescriptionSchema,
});

/** Which way "Move up" and "Move down" send a Journey in its Project's list. */
export const moveDirectionSchema = z.enum(["up", "down"], {
  error: "Choose up or down",
});

/**
 * A Journey's Theme override (ticket 11). A null preset clears the override
 * and takes any accent with it: an accent with no preset would have nothing
 * to belong to, so the pair is normalized here rather than refused.
 */
export const journeyThemeSchema = z
  .object({
    preset: themePresetSchema.nullable(),
    accent: accentColorSchema.nullable(),
  })
  .transform(({ preset, accent }) => ({
    preset,
    accent: preset === null ? null : accent,
  }));

/** What the New Journey dialog sends: the title alone. */
export type CreateJourneyInput = z.input<typeof createJourneySchema>;
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>;
export type JourneyThemeInput = z.infer<typeof journeyThemeSchema>;
