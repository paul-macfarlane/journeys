"use client";

import { useRouter } from "next/navigation";

import { setProjectThemeAction } from "@/app/projects/actions";
import { ThemeFields } from "@/components/theme-fields";
import type { Theme } from "@/lib/theme";

/**
 * The Project's Theme on its Settings tab (ticket 11): the picker, wired
 * to the Project's own action. Every Journey in the Project is painted in
 * it unless the Journey overrides it on its own Settings tab.
 */
export function ProjectThemeSettings({
  projectId,
  theme,
}: {
  projectId: string;
  theme: Theme;
}) {
  const router = useRouter();

  return (
    <section aria-labelledby="project-theme" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="project-theme" className="font-medium">
          Theme
        </h2>
        <p className="text-muted-foreground text-sm">
          How participants see this project&apos;s journeys and its public page.
          A journey can choose its own theme on its Settings tab.
        </p>
      </div>
      <ThemeFields
        theme={theme}
        submit={(next) => setProjectThemeAction(projectId, next)}
        // The swatches and the public page read the row; the page's own
        // props are what the picker shows until then.
        onSaved={() => router.refresh()}
      />
    </section>
  );
}
