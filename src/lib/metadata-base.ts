/** The only variables `resolveMetadataBase` reads, so a unit test can pass just these. */
type MetadataBaseEnv = {
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
 * production, locally, and in CI. Any preview deployment — staging and
 * every branch build alike — can sit behind deployment protection, so a
 * link preview built from its origin would point at a page a crawler, or a
 * chat unfurling a link, can never reach (64 finding 12). There the
 * production origin stands in, read off `VERCEL_PROJECT_PRODUCTION_URL`
 * when Vercel's own `VERCEL_ENV` names the deployment `"preview"` and that
 * variable is a non-empty string; every other case, including
 * `"development"` and a `"preview"` with no production URL to read, falls
 * back to `BETTER_AUTH_URL`. Both are Vercel's own System Environment
 * Variables, unset locally and in CI.
 *
 * Pure and database-free, so the cases are a unit test rather than a
 * deployment to find out about.
 */
export function resolveMetadataBase(env: MetadataBaseEnv): URL {
  const onVercelPreview =
    env.VERCEL_ENV === "preview" &&
    typeof env.VERCEL_PROJECT_PRODUCTION_URL === "string" &&
    env.VERCEL_PROJECT_PRODUCTION_URL.length > 0;

  if (onVercelPreview) {
    return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  return new URL(env.BETTER_AUTH_URL);
}
