import Link from "next/link";

import { SignInButtons } from "@/components/sign-in-buttons";
import { getSession } from "@/lib/session";

// The landing page explains the product and offers sign-in. It deliberately
// lists no projects and no journeys: discovery is link-only.
export default async function LandingPage() {
  const session = await getSession();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Journeys
        </h1>
        <p className="text-muted-foreground text-lg">
          Branching, text-based experiences you can write, publish, and share.
        </p>
      </div>

      <div className="text-muted-foreground flex flex-col gap-4 text-base leading-relaxed">
        <p>
          Authors build a journey as a graph of steps and choices: each step is
          one screen of text, and each choice leads to another step until the
          path reaches an ending. Journeys are grouped into projects that a team
          owns together.
        </p>
        <p>
          Publishing takes an immutable snapshot of the draft, so the version a
          participant is walking never shifts under them while you keep editing.
          Participants are anonymous — no account, no sign-up. They read a step,
          make a choice, and live with the consequence.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {session ? (
          <Link
            href="/projects"
            className="text-sm font-medium underline underline-offset-4"
          >
            Go to your projects
          </Link>
        ) : (
          <SignInButtons />
        )}
      </div>
    </main>
  );
}
