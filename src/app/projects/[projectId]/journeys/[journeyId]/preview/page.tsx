import type { Metadata } from "next";

import { PreviewStartScreen } from "../_preview/screens";
import { draftPreviewMetadata, loadDraftPreview } from "../_preview/source";
import { previewChooseAction } from "./actions";

/**
 * The tab title (ticket 91): "Preview: <Journey title>", with the root
 * layout's template appending "· Journeys".
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string; journeyId: string }>;
}): Promise<Metadata> {
  const { projectId, journeyId } = await params;
  return draftPreviewMetadata({ projectId, journeyId });
}

/**
 * The Draft's Preview, first screen (`PreviewStartScreen`). Member-only,
 * same as every other Journey page — a non-Member and an unknown Journey
 * both 404.
 */
export default async function PreviewStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; journeyId: string }>;
  searchParams: Promise<{
    notice?: string | string[];
  }>;
}) {
  const [{ projectId, journeyId }, { notice }] = await Promise.all([
    params,
    searchParams,
  ]);
  const preview = await loadDraftPreview({ projectId, journeyId });

  return (
    <PreviewStartScreen
      preview={preview}
      notice={notice}
      actionFor={(stepId) =>
        previewChooseAction.bind(null, projectId, journeyId, stepId)
      }
    />
  );
}
