"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ProsePage } from "@/components/prose-page";
import { Button } from "@/components/ui/button";

/**
 * The one error boundary under the root layout (ticket 83, ticket 72's
 * Q-corrupt): whatever segment throws while rendering, this replaces it
 * with a page in the app's own voice rather than the framework's bare
 * screen. It renders inside the root layout, so it keeps the fonts, the
 * theme, and the footer.
 *
 * Never the error's own message or stack: an Author's typo in a title and a
 * broken row read the same to whoever hits this, and the digest — logged
 * here, never shown — is what a report back to Paul would carry.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error]", error.digest);
  }, [error]);

  return (
    <ProsePage title="Something went wrong">
      <p>
        This wasn&apos;t anything you did. Trying again usually clears it; if it
        keeps happening, the front page still gets you where you&apos;re going.
      </p>
      <p className="flex flex-wrap gap-4">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="self-center">
          Go home
        </Link>
      </p>
    </ProsePage>
  );
}
