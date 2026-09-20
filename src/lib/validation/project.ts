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

/** A Project is its title; its id is the address, and never authored. */
export const createProjectSchema = z.object({
  title: projectTitleSchema,
});

/** Renaming is the only edit there is. */
export const editProjectSchema = z.object({
  title: projectTitleSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type EditProjectInput = z.infer<typeof editProjectSchema>;
