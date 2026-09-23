import { z } from "zod";

/**
 * Member input shapes, shared by the client form and the server action that
 * backs it (deliberately no `server-only`), mirroring
 * `@/lib/validation/project`.
 */

/** Trimmed and lower-cased before the address itself is validated, so a
 * differently cased or padded email still matches the account it names. */
export const addMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter an email address")),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
