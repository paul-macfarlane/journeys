"use client";

import { CheckIcon, LinkIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/**
 * The address a Participant walks a Journey at, copied in one click. Shown
 * only while a Published Version is live, because before then the address
 * leads nowhere. The whole URL is in the button's tooltip too, for anyone
 * who would rather select it by hand.
 */
const noSubscription = () => () => {};

export function CopyLinkButton({ journeyId }: { journeyId: string }) {
  // The origin is the browser's to know, so the address is built there:
  // null on the server and through hydration, the real one after.
  const origin = useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => null,
  );
  const href = origin === null ? null : `${origin}/j/${journeyId}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (href === null) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      // A browser that refuses the clipboard still shows the address in the
      // tooltip, so there is nothing more to say here.
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Copy participant link"
      title={href ?? undefined}
      disabled={href === null}
      onClick={() => void copy()}
    >
      {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
    </Button>
  );
}
