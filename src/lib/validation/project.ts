import { z } from "zod";

import { slugSchema } from "@/lib/slug";

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

/** The Author supplies a title; the slug is derived for them. */
export const createProjectSchema = z.object({
  title: projectTitleSchema,
});

/**
 * Editing carries the slug too: it is prefilled with the current one, so a
 * new title alone never moves the Project's URL.
 */
export const editProjectSchema = z.object({
  title: projectTitleSchema,
  slug: slugSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type EditProjectInput = z.infer<typeof editProjectSchema>;
