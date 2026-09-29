"use server";

import { choosePreviewStep } from "../_preview/source";

/**
 * The Draft Preview's one server action: where a Step with a Prompt posts
 * its form. Delegates to `choosePreviewStep`, the logic the Draft and a
 * Version's Preview share (ticket 94).
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
