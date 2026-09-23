import { cn } from "@/lib/utils";

/**
 * The app's mark: a path that forks. One trunk rises and splits into two
 * ways, which is the whole product in one glyph — a Participant reads a
 * Step, takes a Choice, and the path they are on becomes a different one.
 *
 * Two renderings share the geometry. `tile` sits the fork on a rounded
 * square in the primary colour (the navbar, the sign-in page, the favicon's
 * twin in `src/app/icon.svg`, and the site footer everywhere, the runner
 * included); `line` draws the fork alone in the current text colour, for a
 * place that should stay quiet — none at the moment, since ticket 34 gave
 * the runner the same footer as every other page.
 *
 * `aria-hidden` by default: the mark always sits beside the name, and a
 * screen reader should hear "Journeys" once.
 */
export function JourneysMark({
  variant = "tile",
  className,
}: {
  variant?: "tile" | "line";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {variant === "tile" ? (
        <rect width="32" height="32" rx="8" className="fill-primary" />
      ) : null}
      <g
        fill="none"
        strokeWidth={variant === "tile" ? 3.4 : 3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={
          variant === "tile" ? "stroke-primary-foreground" : "stroke-current"
        }
      >
        <path d="M16 27.5V17.5c0-4.5-7.5-5-7.5-9.5" />
        <path d="M16 17.5c0-6.5 7.5-6.5 7.5-13" />
      </g>
    </svg>
  );
}

/**
 * The mark and the name together, in the display face. The caller wraps it
 * in whatever it is — a link, a heading — and sizes it through `className`
 * on the text; the mark scales with `markClassName`.
 */
export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <JourneysMark className={cn("size-6", markClassName)} />
      <span className="font-display font-medium tracking-tight">Journeys</span>
    </span>
  );
}

/**
 * The two legal pages, as a labelled navigation so a spec (and a screen
 * reader) can find them on any footer. Plain anchors, never `next/link`:
 * the runner frame carries no client bundle and the pages are static, so a
 * whole-document navigation costs nothing anywhere this renders.
 */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Legal"
      className={cn("flex items-center gap-4 text-sm", className)}
    >
      <a
        href="/privacy"
        className="hover:text-foreground underline-offset-4 hover:underline"
      >
        Privacy
      </a>
      <a
        href="/terms"
        className="hover:text-foreground underline-offset-4 hover:underline"
      >
        Terms
      </a>
    </nav>
  );
}
