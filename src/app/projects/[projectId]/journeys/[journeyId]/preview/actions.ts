"use server";

import { choosePreviewStep } from "./source";

/**
 * The Draft Preview's one server action: where a Step with a Prompt posts
 * its form. Delegates to `choosePreviewStep`, the logic the Draft and a
 * Version's Preview share (ticket 94's D2) — this file's only job is to
 * keep the Draft's binding signature the way `preview/page.tsx` and
 * `preview/[stepId]/page.tsx` already call it.
 */
export async function previewChooseAction(
  projectId: string,
  journeyId: string,
  stepId: string,
  formData: FormData,
): Promise<void> {
  await choosePreviewStep(
    projectId,
    journeyId,
    { kind: "draft" },
    stepId,
    formData,
  );
}
