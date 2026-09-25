import type { CSSProperties, ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { themeStyle, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * The header's "Start over" (ticket 69): a link, on Preview, which records
 * nothing and so has nothing to drop; or a form action, in the live runner,
 * which has a Run cookie to drop.
 */
export type StartOverControl =
  { href: string } | { action: (formData: FormData) => Promise<void> };

/**
 * The header's link and control: small and muted, the foreground on hover,
 * underlined only then so they read as the way out rather than as the
 * title. Keyboard focus is the solid 2px outline in the ring colour the
 * Choices carry (ticket 63), offset so it sits around the text; every
 * preset's ring clears the background in both schemes, and an accent
 * replaces it. `outline-solid` is explicit for the button, whose reset
 * would otherwise leave the outline style unset.
 */
const wayOutClassName =
  "text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid";

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
 * The header is also the way out (ticket 69): the Project's title above the
 * Journey's, a link to the Project page — the public one for a Participant,
 * the Author's for Preview — and, at the right, "Start over" on every Step
 * that does not already offer one below it (an Ending, the path-full
 * notice, the first screen's resume box), so no screen shows two. Live it is the
 * `startOverAction` form, which drops the Run cookie and leaves the Run
 * abandoned for the analytics (ticket 10); on Preview it is a link to the
 * first screen. The pages decide which and when; the frame only draws it.
 * The header sticks to the top of the viewport so the way out stays in
 * reach on a long Step — beneath the Author navbar (`top-14`, its height)
 * on Preview, where that bar sticks first.
 *
 * Mobile-first — a Participant arrives on a phone, from a link somebody sent
 * them — so the column is narrow, the padding is small at the smallest size,
 * and nothing inside may push the page sideways. Every link is a plain `<a>`,
 * as in `StepView`: the runner's navigations are whole-document by design,
 * and the frame carries no client bundle of its own.
 *
 * The footer is `SiteFooter`, the same one every other page renders (ticket
 * 34: "consistent throughout") — the wordmark, the copyright line, the
 * GitHub link, and the two legal pages — in small muted text under a
 * border, and painted inside this frame so the mark's tile and the text
 * take the Theme's colours rather than the page's. The Preview pages that
 * wrap this frame in an Author layout get their footer from here alone.
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
  project,
  startOver,
  theme,
  children,
}: {
  /** The Journey's title; absent only on the unavailable screen. */
  title?: string;
  /** Shown beneath the header — the Start Step passes it, nothing else does. */
  description?: string;
  /** Present on Preview: the banner that says so, and the way back. */
  preview?: { editorHref: string };
  /** The Project the Journey belongs to, linked above the Journey's title. */
  project?: { title: string; href: string };
  /** The header's "Start over"; omitted where the screen already offers one. */
  startOver?: StartOverControl;
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
        <header
          className={cn(
            "bg-background sticky z-30 border-b",
            preview ? "top-14" : "top-0",
          )}
        >
          <div className="mx-auto flex w-full max-w-prose items-center justify-between gap-x-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-col break-words">
              {project ? (
                <a
                  href={project.href}
                  className={cn(wayOutClassName, "self-start")}
                >
                  {project.title}
                </a>
              ) : null}
              <p className="font-display text-base font-medium">{title}</p>
            </div>
            {startOver ? (
              "href" in startOver ? (
                <a
                  href={startOver.href}
                  className={cn(wayOutClassName, "shrink-0")}
                >
                  Start over
                </a>
              ) : (
                // A native form and button, as everywhere in the runner: the
                // frame ships no client bundle, and starting over is a POST
                // the action owns.
                <form action={startOver.action} className="shrink-0">
                  <button type="submit" className={wayOutClassName}>
                    Start over
                  </button>
                </form>
              )
            ) : null}
          </div>
        </header>
      ) : null}

      <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        {description ? (
          <p className="text-muted-foreground text-lg">{description}</p>
        ) : null}
        {children}
      </main>

      <SiteFooter width="prose" />
    </div>
  );
}
