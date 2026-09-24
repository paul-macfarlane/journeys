import Link from "next/link";

import { JourneysMark } from "@/components/brand";
import { CanvasDemo } from "@/components/canvas-demo";
import { FeatureGrid } from "@/components/feature-grid";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { PLAY_JOURNEY_HREF, PLAY_JOURNEY_LABEL } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

// The splash page (ticket 54): the recording of the canvas as the hero, six
// feature cards, a way to play a seeded Journey without an account, and one
// call to action. It deliberately lists no projects and no journeys:
// discovery is link-only. Provider choice lives on /sign-in. The entrance
// fade is `animate-in` from tw-animate-css, which respects
// `prefers-reduced-motion` by itself.
export default async function LandingPage() {
  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 py-16 sm:gap-20 sm:py-20">
        <section className="animate-in fade-in flex flex-col gap-6 duration-700 motion-reduce:animate-none">
          {/* The mark is decorative here: the heading already says the name. */}
          <JourneysMark className="size-14 sm:size-16" />
          <h1 className="max-w-4xl text-5xl font-medium tracking-tight sm:text-7xl">
            Journeys
          </h1>
          <p className="text-muted-foreground max-w-2xl text-xl leading-relaxed sm:text-2xl">
            Branching, text-based journeys you write, publish, and share.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={PLAY_JOURNEY_HREF}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              {PLAY_JOURNEY_LABEL}
            </Link>
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
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                )}
              >
                Sign in
              </Link>
            )}
          </div>
        </section>

        {/* The canvas in use: a silent loop, the poster under reduced
            motion, one recording per theme (ticket 38). */}
        <CanvasDemo />

        <section className="text-muted-foreground flex max-w-prose flex-col gap-4 text-lg leading-relaxed">
          <p>
            Authors build a journey as a graph of steps and choices: each step
            is one screen of text, and each choice leads to another step until
            the path reaches an ending. Publishing takes an immutable snapshot
            of the draft, and participants walk it from a link — no account, no
            sign-up.
          </p>
          <p>
            Journeys began as three interactive cases for healthcare education.{" "}
            <Link
              href="/about"
              className="hover:text-foreground text-foreground underline underline-offset-4"
            >
              Read the story
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-8">
          <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
            What it does
          </h2>
          <FeatureGrid />
          <p className="text-muted-foreground">
            New here?{" "}
            <Link
              href="/guide"
              className="hover:text-foreground text-foreground underline underline-offset-4"
            >
              Read the guide
            </Link>{" "}
            to write your first journey.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
