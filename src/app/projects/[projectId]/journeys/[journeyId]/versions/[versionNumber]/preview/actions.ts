"use server";

import { choosePreviewStep } from "../../../preview/source";

/**
 * A Version Preview's one server action: where a Step with a Prompt posts
 * its form. Delegates to `choosePreviewStep`, the logic the Draft and a
 * Version's Preview share (ticket 94's D2).
 */
export async function versionPreviewChooseAction(
  projectId: string,
  journeyId: string,
  versionNumber: number,
  stepId: string,
  formData: FormData,
): Promise<void> {
  await choosePreviewStep(
    projectId,
    journeyId,
    { kind: "version", versionNumber },
    stepId,
    formData,
  );
}
