import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

// Request-scoped session read for Server Components and server actions.
// cache() dedupes the lookup within a single render pass.
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// The authoritative gate for Author-only pages. src/proxy.ts bounces
// cookieless requests for a faster redirect, but it only checks that a
// cookie exists — a stale or revoked one still reaches here, which is why
// every Author page calls this itself rather than trusting the proxy or a
// layout (layouts and pages render in parallel).
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  return session;
}
