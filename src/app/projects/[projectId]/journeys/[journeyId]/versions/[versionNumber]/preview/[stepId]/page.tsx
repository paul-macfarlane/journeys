import type { Metadata } from "next";

import {
  PreviewStepScreen,
  VersionPreviewUnreadable,
} from "../../../../_preview/screens";
import {
  loadVersionPreview,
  versionPreviewMetadata,
} from "../../../../_preview/source";
import { versionPreviewChooseAction } from "../actions";

type Params = Promise<{
  projectId: string;
  journeyId: string;
  versionNumber: string;
  stepId: string;
}>;

/**
 * The tab title: "Preview: Version <n>: <version title>" — the same title
 * on every Step screen as on this Version Preview's start screen.
 */
export async function generateMetadata({
  params,
}: {
  params: Params;
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
 * A Published Version's Preview, per-Step screen (ticket 94): one Step of
 * the Version, walked exactly the way the Draft's Preview walks the Draft
 * (`PreviewStepScreen`). A Version whose row cannot be read says so
 * instead — even for a `stepId` that would otherwise 404, since there is
 * no document to check it against.
 */
export default async function VersionPreviewStepPage({
  params,
  searchParams,
}: {
  params: Params;
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
      <VersionPreviewUnreadable
        versionNumber={result.versionNumber}
        viewHref={result.viewHref}
      />
    );
  }

  return (
    <PreviewStepScreen
      preview={result.loaded}
      stepId={stepId}
      notice={notice}
      actionFor={(target) =>
        versionPreviewChooseAction.bind(
          null,
          projectId,
          journeyId,
          result.versionNumber,
          target,
        )
      }
    />
  );
}
