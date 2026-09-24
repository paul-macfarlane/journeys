import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Authors sign in with Google or Discord; there is no password login and
  // Participants never have an account at all. Both client pairs are
  // required by env validation, so both providers are always enabled.
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    },
  },
  // better-auth's own update endpoint would let a signed-in Author set any
  // name or image with no rules. The Settings page (ticket 52) is the one
  // validated path for the name, and the image is only ever the provider's,
  // so the endpoint is closed: nothing in the app calls it.
  disabledPaths: ["/update-user"],
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
