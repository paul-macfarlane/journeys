import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Authors sign in with Google or Discord. Participants never need an
          account.
        </p>
      </div>
      <SignInButtons />
      <Link
        href="/"
        className="text-muted-foreground text-sm underline underline-offset-4"
      >
        Back to Journeys
      </Link>
    </main>
  );
}
