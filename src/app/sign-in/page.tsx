import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand";
import { SignInButtons } from "@/components/sign-in-buttons";
import { SiteFooter } from "@/components/site-footer";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  // Not a page anyone should land on from a search result (ticket 42): it
  // is reached only from the front page or a redirect, and offers a
  // crawler nothing of its own to index.
  robots: { index: false },
};

// The one place an Author chooses a provider. src/proxy.ts bounces requests
// that already carry a session cookie; this check covers a cookie that
// exists but is no longer valid the other way round.
export default async function SignInPage() {
  const session = await getSession();
  if (session) {
    redirect("/projects");
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
        <Link href="/" className="self-start">
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Authors sign in with Google or Discord. Participants never need an
            account.
          </p>
        </div>
        <SignInButtons />
        <p className="text-muted-foreground text-xs leading-relaxed">
          By signing in you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-4">
            terms of service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
