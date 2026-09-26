import "server-only";

import { z } from "zod";

// Configuration is validated once, at first import, so a misconfigured
// deployment fails at boot rather than at an Author's first sign-in.
// Server-only: never import this from a client component.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),

  // Both providers are always enabled, so both client pairs are required.
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),

  // Optional: the Judge (deciding Prompts) falls back to letting the Participant
  // choose when this is absent. .env.example tells a developer to leave it
  // empty for that, so a blank value reads as absent rather than as a
  // configuration error.
  AI_GATEWAY_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates an environment record. Pure: it reads nothing from the process,
 * so it can be exercised directly. Throws an Error naming every field that
 * failed, because a partial boot with half-valid configuration is worse than
 * no boot at all.
 */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }

  const fieldErrors = z.flattenError(parsed.error).fieldErrors;
  const problems = Object.entries(fieldErrors).map(
    ([field, messages]) => `${field}: ${(messages ?? []).join(", ")}`,
  );

  throw new Error(`Invalid environment variables — ${problems.join("; ")}`);
}

export const env = parseEnv(process.env);
