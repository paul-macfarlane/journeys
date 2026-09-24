import Link from "next/link";

import { JourneysMark } from "@/components/brand";
import { CanvasDemo } from "@/components/canvas-demo";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

// The landing page explains the product and offers sign-in. It deliberately
// lists no projects and no journeys: discovery is link-only. Provider
// choice lives on /sign-in so the landing page has one call to action.
export default async function LandingPage() {
  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="flex flex-col gap-6">
          {/* The mark is decorative here: the heading already says the name. */}
          <JourneysMark className="size-14 sm:size-16" />
          <h1 className="text-5xl font-medium tracking-tight sm:text-6xl">
            Journeys
          </h1>
          <p className="text-muted-foreground max-w-prose text-lg leading-relaxed sm:text-xl">
            Branching, text-based experiences you can write, publish, and share.
          </p>
        </div>

        {/* The canvas in use: a silent loop, the poster under reduced
            motion, one recording per theme (ticket 38). */}
        <CanvasDemo />

        <div className="text-muted-foreground flex max-w-prose flex-col gap-4 text-base leading-relaxed">
          <p>
            Authors build a journey as a graph of steps and choices: each step
            is one screen of text, and each choice leads to another step until
            the path reaches an ending. Journeys are grouped into projects that
            a team owns together.
          </p>
          <p>
            Publishing takes an immutable snapshot of the draft, so the version
            a participant is walking never shifts under them while you keep
            editing. Participants are anonymous — no account, no sign-up. They
            read a step, make a choice, and live with the consequence.
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
            // A real link styled as a button: Base UI's Button would either
            // warn about a non-native element or stamp role="button" on the
            // anchor.
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ size: "lg" }), "self-start")}
            >
              Sign in
            </Link>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
