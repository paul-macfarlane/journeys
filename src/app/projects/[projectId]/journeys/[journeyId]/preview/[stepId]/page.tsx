import type { Metadata } from "next";

import { PreviewStepScreen } from "../../_preview/screens";
import { draftPreviewMetadata, loadDraftPreview } from "../../_preview/source";
import { previewChooseAction } from "../actions";

/**
 * The tab title (ticket 91): "Preview: <Journey title>", with the root
 * layout's template appending "· Journeys" — the same title on every Step
 * screen as on Preview's start screen.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string; journeyId: string; stepId: string }>;
}): Promise<Metadata> {
  const { projectId, journeyId, stepId } = await params;
  return draftPreviewMetadata({ projectId, journeyId, stepId });
}

/**
 * The Draft's Preview, per-Step screen (`PreviewStepScreen`). Member-only,
 * same as every other Journey page — a non-Member and an unknown Step both
 * 404.
 */
export default async function PreviewStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; journeyId: string; stepId: string }>;
  searchParams: Promise<{
    notice?: string | string[];
  }>;
}) {
  const [{ projectId, journeyId, stepId }, { notice }] = await Promise.all([
    params,
    searchParams,
  ]);
  const preview = await loadDraftPreview({ projectId, journeyId });

  return (
    <PreviewStepScreen
      preview={preview}
      stepId={stepId}
      notice={notice}
      actionFor={(target) =>
        previewChooseAction.bind(null, projectId, journeyId, target)
      }
    />
  );
}
