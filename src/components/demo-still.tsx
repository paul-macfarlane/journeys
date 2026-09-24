import { cn } from "@/lib/utils";

/**
 * One of the stills `scripts/record-landing-demo.ts` writes under
 * `public/demo/` (ticket 38), in one theme: `/demo/<slug>-<scheme>.png`.
 * The caller shows the one matching the page's theme and hides the other
 * by CSS alone, so no client script is needed.
 *
 * A plain `<img>`: the still is a picture of the app, already sized to its
 * frame, and next/image would only add a loader hop for a file that ships
 * beside the page. `data-still` and `data-scheme` are what the specs
 * locate it by.
 */
export function DemoStill({
  slug,
  scheme,
  alt,
  className,
}: {
  slug: string;
  scheme: "light" | "dark";
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={cn("aspect-video w-full", className)}
      src={`/demo/${slug}-${scheme}.png`}
      width={1280}
      height={720}
      alt={alt}
      data-still={slug}
      data-scheme={scheme}
    />
  );
}
