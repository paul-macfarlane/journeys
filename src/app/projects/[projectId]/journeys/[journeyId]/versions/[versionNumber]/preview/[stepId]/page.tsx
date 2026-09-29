import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CannotBeRead } from "@/components/cannot-be-read";
import { RunnerFrame } from "@/components/runner/runner-frame";
import {
  choiceLinkClassName,
  ResponseNotice,
  responseRefusal,
  StepView,
} from "@/components/runner/step-view";
import { SiteFooter } from "@/components/site-footer";
import { hasStep, isEnding } from "@/lib/graph/document";
import { parseVersionNumber } from "@/lib/version-number";

import { versionPreviewChooseAction } from "../actions";
import { loadVersionPreview, versionPreviewMetadata } from "../load";

/**
 * The tab title: "Preview: Version <n>: <version title>" — the same title
 * on every Step screen as on this Version Preview's start screen.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    projectId: string;
    journeyId: string;
    versionNumber: string;
    stepId: string;
  }>;
}): Promise<Metadata> {
  const { projectId, journeyId, versionNumber, stepId } = await params;
  return versionPreviewMetadata({
    projectId,
    journeyId,
    versionNumber,
    stepId,
  });
}

/**
 * A Published Version's Preview, per-Step screen (ticket 94, D2): one Step
 * of the Version, walked exactly the way a Participant would walk it, in
 * the participant runner's own frame, but recording nothing. A Step the
 * Version does not have is a 404, like every other Journey page. A Version
 * whose row cannot be read renders a `CannotBeRead` instead — even for a
 * `stepId` that would otherwise 404, since there is no document to check it
 * against.
 */
export default async function VersionPreviewStepPage({
  params,
  searchParams,
}: {
  params: Promise<{
    projectId: string;
    journeyId: string;
    versionNumber: string;
    stepId: string;
  }>;
  searchParams: Promise<{
    notice?: string | string[];
  }>;
}) {
  const [{ projectId, journeyId, versionNumber, stepId }, { notice }] =
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

  const { journey, document, title, base, backHref, backLabel, theme } = result;
  if (!hasStep(document, stepId)) notFound();
  const step = document.steps[stepId];
  const versionNumberValue = parseVersionNumber(versionNumber)!;

  return (
    <RunnerFrame
      title={title}
      // The description belongs to the Start Step alone, as in the runner.
      description={
        stepId === document.startStepId
          ? result.description || undefined
          : undefined
      }
      preview={{ editorHref: backHref, label: backLabel }}
      project={{ title: journey.project.title, href: `/projects/${projectId}` }}
      startOver={isEnding(step) ? undefined : { href: base }}
      theme={theme}
    >
      <ResponseNotice notice={notice} />

      <StepView
        step={step}
        document={document}
        choices={
          step.prompt !== null
            ? {
                kind: "form",
                action: versionPreviewChooseAction.bind(
                  null,
                  projectId,
                  journeyId,
                  versionNumberValue,
                  stepId,
                ),
                refusal: responseRefusal(notice),
              }
            : {
                kind: "links",
                href: (targetStepId) => `${base}/${targetStepId}`,
              }
        }
        startOver={
          <a href={base} className={choiceLinkClassName}>
            Start over
          </a>
        }
      />
    </RunnerFrame>
  );
}
