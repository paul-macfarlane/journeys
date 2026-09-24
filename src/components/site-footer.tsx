import { LegalLinks, Wordmark } from "@/components/brand";
import { COPYRIGHT_HOLDER, COPYRIGHT_YEAR, REPOSITORY_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The one footer, rendered everywhere: the landing page, the sign-in page,
 * both legal pages, every Author page (inside the two navbar layouts), and
 * the runner (inside `RunnerFrame`, where it replaced the "Made with
 * Journeys" line). A server component with plain anchors on purpose — the
 * runner ships no client bundle, and the other surfaces need nothing a
 * client component would add — so this is the one place the app names
 * itself, consistent everywhere a Participant or an Author sees it.
 */
export function SiteFooter({
  width = "page",
}: {
  /** `"prose"` for the runner and the legal pages; `"page"` (default) for
   * Author pages, the landing page, and sign-in. */
  width?: "prose" | "page";
}) {
  return (
    <footer className="border-t">
      <div
        className={cn(
          "mx-auto flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm text-muted-foreground sm:px-6",
          width === "prose" ? "max-w-prose" : "max-w-7xl",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a
            plain anchor on purpose: this component renders inside
            RunnerFrame, which ships no client bundle. */}
        <a href="/" className="hover:text-foreground inline-flex items-center">
          <Wordmark />
        </a>
        <span>
          © {COPYRIGHT_YEAR} {COPYRIGHT_HOLDER}
        </span>
        <a
          href="/about"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          About
        </a>
        <a
          href="/guide"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          Guide
        </a>
        <a
          href={REPOSITORY_URL}
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          GitHub
        </a>
        <LegalLinks />
      </div>
    </footer>
  );
}
