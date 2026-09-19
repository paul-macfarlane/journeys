import { createAuthClient } from "better-auth/react";

// Client-side auth API (sign-in, sign-out, session hook) for the interactive
// islands on the landing and projects pages.
export const authClient = createAuthClient();
