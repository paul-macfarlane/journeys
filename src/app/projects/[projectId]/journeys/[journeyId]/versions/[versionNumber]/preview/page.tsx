import type { Metadata } from "next";

import {
  PreviewStartScreen,
  VersionPreviewUnreadable,
} from "../../../_preview/screens";
import {
  loadVersionPreview,
  versionPreviewMetadata,
} from "../../../_preview/source";
import { versionPreviewChooseAction } from "./actions";

type Params = Promise<{
  projectId: string;
  journeyId: string;
  versionNumber: string;
}>;

/**
 * The tab title: "Preview: Version <n>: <version title>", with the root
 * layout's template appending "· Journeys".
 */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { projectId, journeyId, versionNumber } = await params;
  return versionPreviewMetadata({ projectId, journeyId, versionNumber });
}

/**
 * A Published Version's Preview, first screen (ticket 94): the Version's
 * own Start Step, walked exactly the way the Draft's Preview walks the
 * Draft (`PreviewStartScreen`), with the way back naming the Version.
 * Member-only, same as every other Journey page. A Version whose row
 * cannot be read says so instead of the frame.
 */
export default async function VersionPreviewStartPage({
  params,
  searchParams,
}: {
  params: Params;
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
      <VersionPreviewUnreadable
        versionNumber={result.versionNumber}
        viewHref={result.viewHref}
      />
    );
  }

  return (
    <PreviewStartScreen
      preview={result.loaded}
      notice={notice}
      actionFor={(stepId) =>
        versionPreviewChooseAction.bind(
          null,
          projectId,
          journeyId,
          result.versionNumber,
          stepId,
        )
      }
    />
  );
}
