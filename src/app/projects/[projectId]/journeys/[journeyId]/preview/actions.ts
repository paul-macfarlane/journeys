"use server";

import { redirect } from "next/navigation";

import { getDraftForMember } from "@/db/drafts";
import { hasStep } from "@/lib/graph/document";
import { readResponse, refusalNotice } from "@/lib/graph/prompt";
import { requireSession } from "@/lib/session";

/**
 * Preview's one server action: where a Step with a Prompt posts its form.
 * Preview walks the Draft through the participant runner's own components,
 * so a prompted Step offers the same textbox and the same submit buttons a
 * Participant would see — and they have to post somewhere. This is that
 * somewhere, and it records nothing: it reads the answer with the runner's
 * own rule, so a required Prompt left blank is refused here exactly as it
 * would be live, and then it goes where the Choice leads. Member-only like
 * every Preview page; a non-Member is sent to the Journey page, which 404s.
 */
export async function previewChooseAction(
  projectId: string,
  journeyId: string,
  stepId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  const draft = await getDraftForMember(projectId, journeyId, session.user.id);
  if (!draft) redirect(journeyHref);

  const base = `${journeyHref}/preview`;
  // A Step the Draft no longer has (deleted in another tab): back to the
  // start of Preview, which is where a stale link would land too.
  if (!hasStep(draft, stepId)) redirect(base);

  const here = `${base}/${stepId}`;
  const reading = readResponse(draft.steps[stepId], formData.get("response"));
  const refused = refusalNotice(reading);
  if (refused) redirect(`${here}?notice=${refused}`);

  const to = formData.get("to");
  if (typeof to === "string" && hasStep(draft, to)) redirect(`${base}/${to}`);

  // An Ending's "Save response", or a stale Choice: the Author stays where
  // they are, told that nothing was recorded rather than left wondering.
  redirect(
    reading.kind === "answered" ? `${here}?notice=response-preview` : here,
  );
}
