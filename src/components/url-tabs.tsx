"use client";

import { useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withTab } from "@/lib/tabs";

export type UrlTab = {
  value: string;
  label: string;
  content: ReactNode;
};

/**
 * A page's main sections as tabs, the open one named in the address as
 * `?tab=<value>` so a reload or a shared link opens on it. The server page
 * reads the parameter (`readTab`) and hands the result in as `initialTab`;
 * switching rewrites the address in place, with no navigation, and the
 * first tab is the default the plain address means.
 *
 * Only the open tab's content is mounted: the Journey editor is heavy, and
 * the Versions list must show what a restore just did, which a fresh mount
 * reads off the page's own props.
 */
export function UrlTabs({
  label,
  tabs,
  initialTab,
}: {
  /** What the row of tabs is called to a screen reader. */
  label: string;
  tabs: readonly UrlTab[];
  initialTab: string;
}) {
  const [tab, setTab] = useState(initialTab);

  function change(next: unknown) {
    if (typeof next !== "string") return;
    setTab(next);
    window.history.replaceState(
      null,
      "",
      withTab(
        window.location.href,
        tabs.map((entry) => entry.value),
        next,
      ),
    );
  }

  return (
    <Tabs value={tab} onValueChange={change} className="gap-6">
      <TabsList aria-label={label}>
        {tabs.map((entry) => (
          <TabsTrigger key={entry.value} value={entry.value}>
            {entry.label}
          </TabsTrigger>
        ))}
      </TabsList>
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
