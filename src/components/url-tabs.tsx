"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readTab, withTab } from "@/lib/tabs";

export type UrlTab = {
  value: string;
  label: string;
  content: ReactNode;
};

/**
 * A page's main sections as tabs, the open one named in the address as
 * `?tab=<value>` so a reload or a shared link opens on it. The address is
 * the one source of truth: the open tab is read off it (`readTab`) on the
 * server and on the client alike, switching replaces it through the router,
 * and the first tab is the default the plain address means. So anything on
 * the page can open a tab by linking to its address — the Versions tab's
 * Draft row links to the editor that way.
 *
 * The switch goes through `router.replace`, not a bare
 * `history.replaceState` (ticket 69): the metadata forms write on the way
 * out of a tab, and a server action still in flight when the address is
 * rewritten under it made Next answer the mismatch with a full page load —
 * the tab clicked next landed on a page mid-reload. A router navigation
 * queues behind the action instead. `scroll: false` keeps the page where
 * it is, as the rewrite did.
 *
 * Only the open tab's content is mounted: the Journey editor is heavy, and
 * the Versions list must show what a restore just did, which a fresh mount
 * reads off the page's own props.
 *
 * `sticky` pins the row of tabs under the sticky navbar (`top-14`, the
 * bar's height) from tablet width up, on a band of page background across
 * the content column with a bottom border, so the page header scrolls away
 * and the tabs stay. At phone width nothing but the navbar sticks. The
 * band's `data-slot` is what `globals.css` keys the document's scroll
 * padding off, so a focus move or an anchored jump lands below both rows
 * rather than under them.
 */
export function UrlTabs({
  label,
  tabs,
  sticky = false,
}: {
  /** What the row of tabs is called to a screen reader. */
  label: string;
  tabs: readonly UrlTab[];
  /** Keep the row of tabs under the navbar while the page scrolls. */
  sticky?: boolean;
}) {
  const values = tabs.map((entry) => entry.value);
  // A tab click and a link to `?tab=…` both land here. Both pages that use this
  // render dynamically (they read the session), so no Suspense boundary is
  // needed; turning on Cache Components would call for one around it.
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = readTab(values, searchParams.get("tab") ?? undefined);

  function change(next: unknown) {
    if (typeof next !== "string") return;
    router.replace(withTab(window.location.href, values, next), {
      scroll: false,
    });
  }

  const list = (
    <TabsList aria-label={label}>
      {tabs.map((entry) => (
        <TabsTrigger key={entry.value} value={entry.value}>
          {entry.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  return (
    <Tabs value={tab} onValueChange={change} className="gap-6">
      {sticky ? (
        <div
          data-slot="sticky-tabs"
          className="sm:sticky sm:top-14 sm:z-30 sm:border-b sm:bg-background sm:py-2"
        >
          {list}
        </div>
      ) : (
        list
      )}
      {tabs.map((entry) => (
        <TabsContent
          key={entry.value}
          value={entry.value}
          className="text-base"
        >
          {entry.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
