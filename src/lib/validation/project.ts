import { z } from "zod";

/**
 * Project input shapes, shared by the client forms and the server actions
 * that back them (deliberately no `server-only`): one schema means the
 * dialog and the action can never disagree about what a valid Project is.
 */

export const projectTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(120, "Use 120 characters or fewer");

/**
 * A short summary, shown under the title and, once ticket 07 lands, on the
 * public Project page. Empty is allowed (the column defaults to `''`) — the
 * form always sends a string, so there is nothing for a schema-level
 * `.default()` to do, and one would only fight react-hook-form's inferred
 * field type.
 */
export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Use 500 characters or fewer");

/** A new Project is its title; its id is the address, and never authored. */
export const createProjectSchema = z.object({
  title: projectTitleSchema,
});

/** Title and description are the whole of a Project's settings. */
export const editProjectSchema = z.object({
  title: projectTitleSchema,
  description: projectDescriptionSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type EditProjectInput = z.infer<typeof editProjectSchema>;
