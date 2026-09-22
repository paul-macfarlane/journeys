import Link from "next/link";
import type { ReactNode } from "react";

import { LegalLinks, Wordmark } from "@/components/brand";
import { LEGAL_UPDATED } from "@/lib/brand";

/**
 * The shell the two legal pages share: the wordmark as the way home, the
 * title, the date, the text, and the footer that links to the other page.
 * Static, so a Participant sent here from the runner and an Author sent
 * here from the sign-in page get the same page with no session read.
 *
 * The prose rules are written once here as arbitrary variants rather than
 * a typography plugin: two pages of headings, paragraphs, and lists do not
 * need one.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
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
          <p className="text-muted-foreground text-sm">
            Last updated {LEGAL_UPDATED}
          </p>
        </div>
        <div className="[&_a]:hover:text-foreground flex flex-col gap-4 leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-medium [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6">
          {children}
        </div>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-prose items-center justify-between gap-4 px-4 py-4 text-sm sm:px-6">
          <Link href="/" className="hover:text-foreground">
            Back to Journeys
          </Link>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
