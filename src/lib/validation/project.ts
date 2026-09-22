import { z } from "zod";

/**
 * Project input shapes, shared by the client forms and the server actions
 * that back them (deliberately no `server-only`): one schema means the
 * dialog and the action can never disagree about what a valid Project is.
 *
 * The description is not here: it is rich text (ticket 07), the same
 * `Content` a Step holds, and it is cleaned by `sanitizeContent` in
 * `@/lib/graph/content` rather than parsed by a schema.
 */

export const projectTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(120, "Use 120 characters or fewer");

/** A new Project is its title; its id is the address, and never authored. */
export const createProjectSchema = z.object({
  title: projectTitleSchema,
});

/** The title is the one plain-text field on the Settings tab. */
export const renameProjectSchema = z.object({
  title: projectTitleSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type RenameProjectInput = z.infer<typeof renameProjectSchema>;
