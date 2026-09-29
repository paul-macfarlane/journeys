import type { Metadata } from "next";

import { CannotBeRead } from "@/components/cannot-be-read";
import { RunnerFrame } from "@/components/runner/runner-frame";
import {
  ResponseNotice,
  responseRefusal,
  StepView,
} from "@/components/runner/step-view";
import { SiteFooter } from "@/components/site-footer";
import { hasStep } from "@/lib/graph/document";
import { parseVersionNumber } from "@/lib/version-number";

import { versionPreviewChooseAction } from "./actions";
import { loadVersionPreview, versionPreviewMetadata } from "./load";

/**
 * The tab title: "Preview: Version <n>: <version title>", with the root
 * layout's template appending "· Journeys".
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    projectId: string;
    journeyId: string;
    versionNumber: string;
  }>;
}): Promise<Metadata> {
  const { projectId, journeyId, versionNumber } = await params;
  return versionPreviewMetadata({ projectId, journeyId, versionNumber });
}

/**
 * A Published Version's Preview, first screen (ticket 94, D2): the
 * Version's own Start Step, walked exactly the way the Draft's Preview
 * walks the Draft — the same frame, the same banner, the same Choice links
 * and Prompt form, recording nothing. The Version's own title and
 * description show, not the Journey's current ones, but the Theme is the
 * Journey's current effective one, since a Published Version snapshots no
 * Theme. The way back names the Version, not "editor". Member-only, same
 * as every other Journey page. A Version whose row cannot be read renders
 * a `CannotBeRead` instead of the frame — never a crash, never a redirect
 * loop.
 */
export default async function VersionPreviewStartPage({
  params,
  searchParams,
}: {
  params: Promise<{
    projectId: string;
    journeyId: string;
    versionNumber: string;
  }>;
  searchParams: Promise<{
    notice?: string | string[];
  }>;
}) {
  const [{ projectId, journeyId, versionNumber }, { notice }] =
    await Promise.all([params, searchParams]);
  const result = await loadVersionPreview({
    projectId,
    journeyId,
    versionNumber,
  });

  if (result.kind === "unreadable") {
    return (
      <>
        <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
          <CannotBeRead title={`Version ${result.versionNumber} can't be read`}>
            <p>
              {`Version ${result.versionNumber} is stored in a shape the runner can’t read, so it can’t be previewed.`}
            </p>
          </CannotBeRead>
        </main>
        <SiteFooter width="prose" />
      </>
    );
  }

  const {
    journey,
    document,
    title,
    description,
    theme,
    base,
    backHref,
    backLabel,
  } = result;
  const versionNumberValue = parseVersionNumber(versionNumber)!;
  const hasStart = hasStep(document, document.startStepId);

  return (
    <RunnerFrame
      title={title}
      description={description || undefined}
      preview={{ editorHref: backHref, label: backLabel }}
      // The way out (ticket 69), pointed at this Version Preview's own
      // routes: the Author's Project page.
      project={{ title: journey.project.title, href: `/projects/${projectId}` }}
      theme={theme}
    >
      {hasStart ? (
        <>
          <ResponseNotice notice={notice} />
          <StepView
            step={document.steps[document.startStepId]}
            document={document}
            choices={
              document.steps[document.startStepId].prompt !== null &&
              document.steps[document.startStepId].choices.length > 0
                ? {
                    kind: "form",
                    action: versionPreviewChooseAction.bind(
                      null,
                      projectId,
                      journeyId,
                      versionNumberValue,
                      document.startStepId,
                    ),
                    refusal: responseRefusal(notice),
                  }
                : {
                    kind: "links",
                    href: (stepId) => `${base}/${stepId}`,
                  }
            }
            startOver={null}
          />
        </>
      ) : (
        <p className="text-muted-foreground">This version has no start step.</p>
      )}
    </RunnerFrame>
  );
}
