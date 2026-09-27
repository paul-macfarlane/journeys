/** The three environment variables this function reads, named narrowly so a caller cannot pass the whole `Env` by mistake and get away with a typo. */
export type MetadataBaseEnv = {
  BETTER_AUTH_URL: string;
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

/**
 * The absolute base every relative URL in `Metadata` is resolved against
 * (ticket 42, the 2026-09-26 scope change, item 2): `metadataBase` in the
 * root layout, and the base `robots.ts` and `sitemap.ts` build their own
 * absolute URLs from, since neither runs inside a request and so has no
 * origin of its own to read.
 *
 * `BETTER_AUTH_URL` is the deployment's own origin, which is right in
 * production, locally, and in CI. A Vercel preview deployment (staging and
 * branch builds) can sit behind deployment protection, so a link preview
 * built from its origin would point at a page a crawler, or a chat
 * unfurling a link, can never reach (64 finding 12). There the production
 * origin stands in. "Protected alias" is read as "any non-production
 * Vercel deployment", since protection itself is not visible to the
 * running app: `VERCEL_ENV` is unset locally and in CI, and is exactly
 * `"production"` only on the production deployment, per Vercel's System
 * Environment Variables.
 *
 * Pure and database-free, so the four cases are a unit test rather than a
 * deployment to find out about.
 */
export function resolveMetadataBase(env: MetadataBaseEnv): URL {
  const onVercelPreview =
    env.VERCEL_ENV !== undefined &&
    env.VERCEL_ENV !== "production" &&
    env.VERCEL_PROJECT_PRODUCTION_URL !== undefined;

  if (onVercelPreview) {
    return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  return new URL(env.BETTER_AUTH_URL);
}
