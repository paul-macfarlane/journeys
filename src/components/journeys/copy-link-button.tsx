"use client";

import { CheckIcon, LinkIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/** The origin never changes while the page is open, so nothing to subscribe to. */
const noSubscription = () => () => {};

/**
 * A public address copied in one click: the one a Participant walks a
 * Journey at (`/j/<id>`, shown only while a Published Version is live,
 * because before then the address leads nowhere) or opens a Project at
 * (`/p/<id>`, ticket 07, shown only once the Project has a live Journey of
 * its own to show there — ticket 42, decision 4 — since before then that
 * address leads nowhere too). The whole URL is in the button's tooltip too,
 * for anyone who would rather select it by hand.
 *
 * A browser that refuses `navigator.clipboard.writeText` — it rejects, or
 * there is no `navigator.clipboard` at all (ticket 79 item 5) — gets a
 * second way to the same address: a read-only field beside the button,
 * holding the whole address selected and taking focus on every refused
 * click, so copying it by hand is one keystroke away; the button's live
 * text says so to a screen reader. It stays until the page changes;
 * nothing clears it back.
 */
export function CopyLinkButton({
  path,
  label = "Copy link for participants",
}: {
  path: string;
  /**
   * The button's accessible name. It opens with the words the button shows,
   * "Copy link", so someone who says what they see — voice control — reaches
   * it (WCAG 2.5.3, ticket 78's walk), and goes on to say whose link it is.
   */
  label?: string;
}) {
  // The origin is the browser's to know, so the address is built there:
  // null on the server and through hydration, the real one after.
  const origin = useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => null,
  );
  const href = origin === null ? null : `${origin}${path}`;
  const [copied, setCopied] = useState(false);
  // How many clicks the clipboard has refused: each one, the first included,
  // puts the Member in the field with the address selected again.
  const [refusals, setRefusals] = useState(0);
  const clipboardRefused = refusals > 0;
  const fallbackRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (refusals === 0) return;
    const field = fallbackRef.current;
    field?.focus();
    field?.select();
  }, [refusals]);

  async function copy() {
    if (href === null) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      // Neither a rejected `writeText` nor a missing `clipboard` altogether
      // (both land here) leaves the Member with nothing: the field beside
      // the button holds the address, focused and selected, ready to copy
      // by hand — on this click and every one after it.
      setRefusals((current) => current + 1);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        title={href ?? undefined}
        disabled={href === null}
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
        <span aria-live="polite">
          {copied ? "Copied" : "Copy link"}
          {clipboardRefused ? (
            <span className="sr-only"> Copy it from the field</span>
          ) : null}
        </span>
      </Button>
      {clipboardRefused && href !== null ? (
        <input
          ref={fallbackRef}
          readOnly
          aria-label="Link to copy"
          value={href}
          className="border-input h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
        />
      ) : null}
    </span>
  );
}
