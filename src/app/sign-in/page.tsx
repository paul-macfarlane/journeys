import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LegalLinks, Wordmark } from "@/components/brand";
import { SignInButtons } from "@/components/sign-in-buttons";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
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
          By signing in you agree to the terms of service and privacy policy
          below.
        </p>
      </main>
      <footer className="mx-auto flex w-full max-w-sm items-center justify-between gap-4 px-6 py-6">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to Journeys
        </Link>
        <LegalLinks className="text-muted-foreground" />
      </footer>
    </div>
  );
}
