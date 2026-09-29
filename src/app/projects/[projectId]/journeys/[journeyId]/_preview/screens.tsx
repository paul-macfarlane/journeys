import Link from "next/link";
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

import type { PreviewLoaded } from "./source";

/**
 * The Preview action bound to one Step of the source: the Draft's
 * `previewChooseAction` or a Version's `versionPreviewChooseAction`, with
 * everything but the posted form already bound by the page.
 */
export type PreviewActionFor = (
  stepId: string,
) => (formData: FormData) => Promise<void>;

type ScreenProps = {
  preview: PreviewLoaded;
  notice: string | string[] | undefined;
  actionFor: PreviewActionFor;
};

/**
 * Preview's first screen: the source's Start Step, exactly as a Participant
 * first sees a live Journey (ticket 27) — the same frame, the title in its
 * header, the description beneath it — with a banner saying this is Preview
 * and a way back: to the editor for the Draft, to the Version's own view
 * for a Version (ticket 94). Choices are plain links into the source's
 * Steps, and no Run exists. A Start with a Prompt offers it the way the
 * live Start would — as a form, posting to Preview's own action, which
 * records nothing. A Version shows its own title and description, not the
 * Journey's current ones, but the Theme is the Journey's current effective
 * one, since a Published Version snapshots no Theme.
 */
export function PreviewStartScreen({
  preview,
  notice,
  actionFor,
}: ScreenProps) {
  const { document, source } = preview;
  const hasStart = hasStep(document, document.startStepId);
  const start = hasStart ? document.steps[document.startStepId] : null;

  return (
    <RunnerFrame
      title={preview.title}
      description={preview.description || undefined}
      preview={{ backHref: preview.backHref, label: preview.backLabel }}
      // The way out (ticket 69), pointed at Preview's own routes: the
      // Author's Project page. No header "Start over" here: this is the
      // start, as on the live runner's first screen.
      project={preview.project}
      theme={preview.theme}
    >
      {start !== null ? (
        <>
          <ResponseNotice notice={notice} />
          {/* No "Start over" on an Ending here: this is the start. The live
              Start offers no Prompt while it is an Ending either, so neither
              does this one — links, then, exactly as the runner chooses. */}
          <StepView
            step={start}
            document={document}
            choices={
              start.prompt !== null && start.choices.length > 0
                ? {
                    kind: "form",
                    action: actionFor(start.id),
                    refusal: responseRefusal(notice),
                  }
                : {
                    kind: "links",
                    href: (stepId) => `${preview.base}/${stepId}`,
                  }
            }
            startOver={null}
          />
        </>
      ) : (
        <p className="text-muted-foreground">
          {source.kind === "draft"
            ? "This draft has no start step."
            : "This version has no start step."}
        </p>
      )}
    </RunnerFrame>
  );
}

/**
 * Preview's per-Step screen: one Step of the source, walked exactly the way
 * a Participant would walk it, in the participant runner's own frame, but
 * recording nothing. A Step with a Prompt offers its textbox and posts to
 * Preview's own action, which reads the answer by the runner's rule and
 * stores none of it; `notice` carries that action's one-line answer back.
 * A Step the source does not have is a 404, like every other Journey page.
 */
export function PreviewStepScreen({
  preview,
  stepId,
  notice,
  actionFor,
}: ScreenProps & { stepId: string }) {
  const { document, base } = preview;
  if (!hasStep(document, stepId)) notFound();
  const step = document.steps[stepId];

  return (
    <RunnerFrame
      title={preview.title}
      // The description belongs to the Start Step alone, as in the runner.
      description={
        stepId === document.startStepId
          ? preview.description || undefined
          : undefined
      }
      preview={{ backHref: preview.backHref, label: preview.backLabel }}
      // The way out (ticket 69), pointed at Preview's own routes: the
      // Author's Project page, and the first screen wherever the Step does
      // not offer "Start over" itself — an Ending does, below its Outcome.
      project={preview.project}
      startOver={isEnding(step) ? undefined : { href: base }}
      theme={preview.theme}
    >
      <ResponseNotice notice={notice} />

      <StepView
        step={step}
        document={document}
        choices={
          step.prompt !== null
            ? {
                kind: "form",
                action: actionFor(stepId),
                refusal: responseRefusal(notice),
              }
            : {
                kind: "links",
                href: (targetStepId) => `${base}/${targetStepId}`,
              }
        }
        // Preview records nothing, so starting over is just a link back to
        // its first screen — the runner posts a server action here instead,
        // because starting over there drops the Run cookie.
        startOver={
          <a href={base} className={choiceLinkClassName}>
            Start over
          </a>
        }
      />
    </RunnerFrame>
  );
}

/**
 * Both Version Preview screens when the Version's row cannot be read
 * (ticket 83's pattern): said plainly, with the way back to the Version's
 * own view, which says the same — never a crash, never a redirect loop.
 * A Step screen shows this even for a `stepId` that would otherwise 404,
 * since there is no document to check it against.
 */
export function VersionPreviewUnreadable({
  versionNumber,
  viewHref,
}: {
  versionNumber: number;
  viewHref: string;
}) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <CannotBeRead
          title={`Version ${versionNumber} can't be read`}
          action={
            <Link
              href={viewHref}
              className="text-sm underline underline-offset-4 hover:text-muted-foreground"
            >
              Back to Version {versionNumber}
            </Link>
          }
        >
          <p>
            {`Version ${versionNumber} is stored in a shape the runner can’t read, so it can’t be previewed.`}
          </p>
        </CannotBeRead>
      </main>
      <SiteFooter width="prose" />
    </>
  );
}
