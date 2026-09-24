import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";

/**
 * The shell every prose-only public page shares — the two legal pages,
 * About, and the guide: the wordmark as the way home, the title, an
 * optional line under it, the text, and the footer. The footer spans the
 * page, as on the splash and the sign-in page, rather than the prose column:
 * its six items no longer fit that column at desktop widths, so Privacy and
 * Terms wrapped onto a second row (ticket 62). Static, so a Participant
 * sent here from the runner and an Author sent here from the sign-in page
 * get the same page with no session read.
 *
 * The prose rules are written once here as arbitrary variants rather than
 * a typography plugin: a few pages of headings, paragraphs, lists, and figures
 * do not need one.
 */
export function ProsePage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto w-full max-w-prose px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex">
            <Wordmark className="text-base" markClassName="size-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
        </div>
        <div className="[&_a]:hover:text-foreground flex flex-col gap-4 leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-medium [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-medium [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6">
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
