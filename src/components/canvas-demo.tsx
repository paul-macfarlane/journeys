import { DemoStill } from "@/components/demo-still";
import { cn } from "@/lib/utils";

/**
 * The landing page's recording of the canvas in use (ticket 38): silent,
 * looping, inline, with a poster. Every file under `public/demo/` is written
 * by `scripts/record-landing-demo.ts` from the seeded Journey Stories
 * Project, never by hand, so it can be re-made after any canvas change.
 *
 * One recording per theme, switched with the page's theme by CSS alone —
 * no client component, no script: the light one is shown unless `<html>`
 * carries next-themes' `dark` class, and the dark one only then. Under
 * `prefers-reduced-motion` the videos are hidden and the poster of the
 * matching theme stands in their place, so nothing moves that the visitor
 * asked not to move. The variant stacks below rely on Tailwind v4's `dark`
 * (`.dark *`, two classes of specificity) beating a single `motion-*`
 * variant whatever order the stylesheet lists them in.
 */
export function CanvasDemo() {
  return (
    <figure className="flex flex-col gap-3">
      <div className="ring-foreground/10 overflow-hidden rounded-xl bg-muted shadow-sm ring-1">
        <DemoVideo
          scheme="light"
          className="hidden motion-safe:block dark:hidden"
        />
        <DemoVideo scheme="dark" className="hidden motion-safe:dark:block" />
        <DemoPoster
          scheme="light"
          className="hidden motion-reduce:block dark:hidden"
        />
        <DemoPoster scheme="dark" className="hidden motion-reduce:dark:block" />
      </div>
      <figcaption className="text-muted-foreground text-sm">
        The canvas: open a step from the map, drag a choice onto empty space to
        make the step it leads to, and turn the whole journey the other way
        round.
      </figcaption>
    </figure>
  );
}

const DESCRIPTION =
  "A journey's draft on the canvas: steps opened in the panel, a choice dragged onto empty map to create a step, then the map fitted and turned from top-to-bottom to left-to-right.";

function DemoVideo({
  scheme,
  className,
}: {
  scheme: "light" | "dark";
  className: string;
}) {
  return (
    <video
      className={cn("aspect-video w-full", className)}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={`/demo/canvas-${scheme}.png`}
      aria-label={DESCRIPTION}
      data-scheme={scheme}
    >
      <source src={`/demo/canvas-${scheme}.webm`} type="video/webm" />
    </video>
  );
}

function DemoPoster({
  scheme,
  className,
}: {
  scheme: "light" | "dark";
  className: string;
}) {
  return (
    <DemoStill
      slug="canvas"
      scheme={scheme}
      alt={DESCRIPTION}
      className={className}
    />
  );
}
