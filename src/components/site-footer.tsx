import { AppearanceControl } from "@/components/appearance-control";
import { LegalLinks, Wordmark } from "@/components/brand";
import { FooterLink } from "@/components/footer-link";
import { COPYRIGHT_HOLDER, COPYRIGHT_YEAR, REPOSITORY_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The one footer, rendered everywhere: the landing page, the sign-in page,
 * both legal pages, every Author page (inside the two navbar layouts), and
 * the runner (inside `RunnerFrame`, where it replaced the "Made with
 * Journeys" line). A server component with plain anchors on purpose — the
 * runner's navigations are whole-document by design, and the other surfaces
 * need nothing `next/link` would add — so this is the one place the app
 * names itself, consistent everywhere a Participant or an Author sees it.
 *
 * Two small client islands sit inside it. `AppearanceControl` (ticket 70):
 * light, dark, or the system's, for a guest who has no account menu to
 * choose from. `FooterLink` (ticket 93): the About, Guide, Privacy, and
 * Terms anchors are still plain `<a>` tags everywhere else; it is only the
 * island that knows which one is the current page, marking it
 * `aria-current="page"` with a visible foreground colour. Both are small
 * islands under the root layout's `ThemeProvider` and router, which every
 * page, the runner included, already hydrates. In the runner (`/j/...`)
 * no footer `href` matches the path, so nothing is ever current there.
 */
export function SiteFooter({
  width = "page",
}: {
  /** `"prose"` for the runner, whose whole frame is a prose column;
   * `"page"` (default) everywhere else, including the prose pages (About,
   * the guide, and the two legal pages), where the six items no longer fit
   * the prose column at desktop widths (ticket 62). */
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
        {/* Two groups, not seven loose items (ticket 67): where the row is
            too narrow for everything — a phone, or the runner's prose
            column — the links group drops under the mark and copyright as
            one tidy second row, instead of `justify-between` scattering
            whichever items wrapped across the width. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a
              plain anchor on purpose: this component renders inside
              RunnerFrame, whose navigations are whole-document. */}
          <a
            href="/"
            className="hover:text-foreground inline-flex items-center"
          >
            <Wordmark />
          </a>
          <span>
            © {COPYRIGHT_YEAR} {COPYRIGHT_HOLDER}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <FooterLink href="/about">About</FooterLink>
          <FooterLink href="/guide">Guide</FooterLink>
          <a
            href={REPOSITORY_URL}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            GitHub
          </a>
          <LegalLinks />
          {/* Last in the links group, so on a phone it wraps under them at
              the same left edge rather than splitting the row (ticket 70). */}
          <AppearanceControl />
        </div>
      </div>
    </footer>
  );
}
