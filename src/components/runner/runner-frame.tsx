import type { ReactNode } from "react";

import { JourneysMark, LegalLinks } from "@/components/brand";

/**
 * The shell every participant screen sits in — the Start Step, each later
 * Step, the unavailable screen — and, since ticket 27, every Preview screen
 * too, so the two surfaces cannot drift: what differs between walking a
 * Draft and walking a live Journey is a banner, never the frame.
 *
 * The Journey's title is the frame's header, on every screen that has a
 * Journey to name; a Participant is never inside a Journey without seeing
 * what it is called. The description is a Start Step thing, so the page that
 * shows the Start passes it and the others do not.
 *
 * Mobile-first — a Participant arrives on a phone, from a link somebody sent
 * them — so the column is narrow, the padding is small at the smallest size,
 * and nothing inside may push the page sideways. Every link is a plain `<a>`,
 * as in `StepView`: the runner's navigations are whole-document by design,
 * and the frame carries no client bundle of its own.
 *
 * The footer is the one place the app names itself to a Participant — the
 * mark, the name, and the two legal pages — kept small and in the muted
 * tone so it never competes with the Step. A per-Project Theme (ticket 11)
 * colours the frame through the tokens above it; the footer stays.
 */
export function RunnerFrame({
  title,
  description,
  preview,
  children,
}: {
  /** The Journey's title; absent only on the unavailable screen. */
  title?: string;
  /** Shown beneath the header — the Start Step passes it, nothing else does. */
  description?: string;
  /** Present on Preview: the banner that says so, and the way back. */
  preview?: { editorHref: string };
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {preview ? (
        <div className="bg-muted text-muted-foreground text-sm">
          <div className="mx-auto flex w-full max-w-prose flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
            <span>Preview — nothing is recorded.</span>
            <a
              href={preview.editorHref}
              className="hover:text-foreground underline underline-offset-4"
            >
              Back to editor
            </a>
          </div>
        </div>
      ) : null}

      {title ? (
        <header className="border-b">
          <div className="mx-auto w-full max-w-prose px-4 py-3 sm:px-6">
            <p className="font-display text-base font-medium">{title}</p>
          </div>
        </header>
      ) : null}

      <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        {description ? (
          <p className="text-muted-foreground text-lg">{description}</p>
        ) : null}
        {children}
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-prose flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 text-sm sm:px-6">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a
              plain anchor on purpose: the frame ships no client bundle. */}
          <a
            href="/"
            className="hover:text-foreground inline-flex items-center gap-1.5"
          >
            <JourneysMark variant="line" className="size-4" />
            <span className="font-display">Made with Journeys</span>
          </a>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
