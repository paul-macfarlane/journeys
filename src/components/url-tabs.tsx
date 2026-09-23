"use client";

import { useSearchParams } from "next/navigation";
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
 * server and on the client alike, switching rewrites it in place with no
 * navigation, and the first tab is the default the plain address means. So
 * anything on the page can open a tab by linking to its address — the
 * Versions tab's Draft row links to the editor that way.
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
  // Next keeps this in step with `history.replaceState` below, so a tab
  // click and a link to `?tab=…` both land here.
  const searchParams = useSearchParams();
  const tab = readTab(values, searchParams.get("tab") ?? undefined);

  function change(next: unknown) {
    if (typeof next !== "string") return;
    window.history.replaceState(
      null,
      "",
      withTab(window.location.href, values, next),
    );
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
