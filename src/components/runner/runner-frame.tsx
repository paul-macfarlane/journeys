import type { CSSProperties, ReactNode } from "react";

import { JourneysMark, LegalLinks } from "@/components/brand";
import { themeStyle, type Theme } from "@/lib/theme";

/**
 * The shell every participant screen sits in — the Start Step, each later
 * Step, the unavailable screen, and since ticket 07 the public Project page
 * — and, since ticket 27, every Preview screen too, so the surfaces cannot
 * drift: what differs between walking a Draft and walking a live Journey is
 * a banner, never the frame.
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
 * tone so it never competes with the Step.
 *
 * The frame is also where a Theme (ticket 11) is painted, and the only
 * place: `data-theme` names the preset, which `globals.css` turns into the
 * frame's own token set in both schemes, and an accent arrives as
 * `data-accent` plus inline custom properties, which the same stylesheet
 * maps onto the preset's primary and ring (lifted in the dark scheme). The
 * frame paints its own background rather than inheriting the page's, so
 * the Theme fills the viewport edge to edge; the stripe along the top is
 * the accent's one guaranteed appearance. Nothing outside this frame — no
 * Author page, no editor — ever carries `data-theme` except the picker's
 * own swatches, so `data-slot="runner-frame"` is how a test finds the frame.
 */
export function RunnerFrame({
  title,
  description,
  preview,
  theme,
  children,
}: {
  /** The Journey's title; absent only on the unavailable screen. */
  title?: string;
  /** Shown beneath the header — the Start Step passes it, nothing else does. */
  description?: string;
  /** Present on Preview: the banner that says so, and the way back. */
  preview?: { editorHref: string };
  /** The effective Theme: the Journey's override, else the Project's. */
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="runner-frame"
      data-theme={theme.preset}
      data-accent={theme.accent ?? undefined}
      // Custom properties are not in React's CSSProperties; the cast is the
      // usual way to set them inline.
      style={themeStyle(theme) as CSSProperties}
      className="bg-background text-foreground flex flex-1 flex-col border-t-4 border-t-primary"
    >
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
