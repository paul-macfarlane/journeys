// Server-only data loading — `server-only` so a client import fails the build.
import "server-only";

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { journeyForMember, type MemberJourney } from "@/db/access";
import { getDraft } from "@/db/drafts";
import { getVersionByNumber } from "@/db/versions";
import { hasStep, type GraphDocument } from "@/lib/graph/document";
import { readResponse, refusalNotice } from "@/lib/graph/prompt";
import { requireSession } from "@/lib/session";
import { effectiveTheme, type Theme } from "@/lib/theme";

/**
 * What Preview walks (ticket 94, D2): the Draft, or one Published Version by
 * its number. Both route pairs — `.../preview` and
 * `.../versions/<n>/preview` — share this module's loader and action so the
 * two surfaces cannot drift: what differs between walking the Draft and
 * walking a Version is the source of the graph and the way back, never the
 * runner around it.
 */
export type PreviewSource =
  { kind: "draft" } | { kind: "version"; versionNumber: number };

/**
 * The Journey, resolved for the signed-in Member — a non-Member and an
 * unknown Journey both 404. Cached so every loader and action on a Preview
 * screen pays the membership query once per request.
 */
const loadJourney = cache(async function loadJourney(
  projectId: string,
  journeyId: string,
): Promise<MemberJourney> {
  const session = await requireSession();
  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) notFound();
  return journey;
});

type StoredSource =
  | { kind: "ok"; document: GraphDocument; title: string; description: string }
  /** A row that fails its document contract (ticket 73 for the Draft, 83 for a Version). */
  | { kind: "unreadable" }
  /** No Draft row at all, or a Version number this Journey has none by. */
  | { kind: "missing" };

/**
 * The source's graph as stored, read through its document contract: the
 * Draft (`@/db/drafts`) or a Published Version by number (`@/db/versions`),
 * whichever `sourceKind`/`versionNumber` name. The two routes answer
 * `unreadable` differently — the Draft's redirects, a Version's renders a
 * `CannotBeRead` — so this only reports it.
 */
const loadStoredSource = cache(async function loadStoredSource(
  projectId: string,
  journeyId: string,
  sourceKind: "draft" | "version",
  versionNumber: number | undefined,
): Promise<StoredSource> {
  const journey = await loadJourney(projectId, journeyId);

  if (sourceKind === "draft") {
    const stored = await getDraft(journey);
    if (!stored) return { kind: "missing" };
    if (stored.kind === "unreadable") return { kind: "unreadable" };
    return {
      kind: "ok",
      document: stored.document,
      title: journey.title,
      description: journey.description,
    };
  }

  const version = await getVersionByNumber(journey, versionNumber!);
  if (!version) return { kind: "missing" };
  if (version.kind === "unreadable") return { kind: "unreadable" };
  return {
    kind: "ok",
    document: version.document,
    title: version.title,
    description: version.description,
  };
});

/**
 * Every Choice link, the "Start over" link, and the Preview action all build
 * on one base href per source: `.../preview` for the Draft, and
 * `.../versions/<n>/preview` for a Version. The way back out of Preview
 * differs the same way — the Journey page for the Draft, that Version's own
 * view for a Version — and its label names which (ticket 94's "Back to
 * Version <n>").
 */
function originFor(journeyHref: string, source: PreviewSource) {
  if (source.kind === "draft") {
    return {
      base: `${journeyHref}/preview`,
      backHref: journeyHref,
      backLabel: "Back to editor",
    };
  }
  return {
    base: `${journeyHref}/versions/${source.versionNumber}/preview`,
    backHref: `${journeyHref}/versions/${source.versionNumber}`,
    backLabel: `Back to Version ${source.versionNumber}`,
  };
}

export type PreviewLoaded = {
  journey: MemberJourney;
  document: GraphDocument;
  title: string;
  description: string;
  theme: Theme;
  journeyHref: string;
  base: string;
  backHref: string;
  backLabel: string;
};

export type PreviewResult =
  | ({ kind: "ok" } & PreviewLoaded)
  /**
   * A Published Version whose row cannot be read (ticket 83's pattern):
   * both Version preview routes still answer 200 and say so, rather than
   * crashing or redirecting in a loop.
   */
  | { kind: "unreadable"; versionNumber: number; journeyHref: string };

/**
 * What every Preview screen starts from: the Journey, resolved for the
 * signed-in Member — a non-Member and an unknown Journey both 404 — the
 * source's graph, the title and description it shows (the Journey's own for
 * the Draft, the Version's own for a Version — ticket 94's decision), the
 * Theme a Participant will see, and the hrefs the page builds its links
 * from. A Draft that cannot be read has nothing to preview: the Journey page
 * says so and offers a Restore, so this redirects there. A Version that
 * cannot be read is different: the Journey page never 404s on it, so this
 * reports it instead of bouncing, and the page renders a `CannotBeRead`
 * itself.
 */
export async function loadPreviewSource({
  projectId,
  journeyId,
  source,
}: {
  projectId: string;
  journeyId: string;
  source: PreviewSource;
}): Promise<PreviewResult> {
  const journey = await loadJourney(projectId, journeyId);
  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  const stored = await loadStoredSource(
    projectId,
    journeyId,
    source.kind,
    source.kind === "version" ? source.versionNumber : undefined,
  );

  if (stored.kind === "missing") notFound();

  if (stored.kind === "unreadable") {
    if (source.kind === "draft") redirect(journeyHref);
    return {
      kind: "unreadable",
      versionNumber: source.versionNumber,
      journeyHref,
    };
  }

  return {
    kind: "ok",
    journey,
    document: stored.document,
    title: stored.title,
    description: stored.description,
    theme: effectiveTheme(journey.project.theme, journey.theme),
    journeyHref,
    ...originFor(journeyHref, source),
  };
}

/**
 * Both Preview screens' tab title: "Preview: <Journey title>" for the Draft,
 * "Preview: Version <n>: <version title>" for a Version (the Journey's own
 * title when that Version cannot be read). Everything the screen itself
 * 404s on 404s here too — a non-Member, an unknown Journey, a missing
 * source, and on a Step screen (`stepId`) a Step the source does not have —
 * since metadata streams in after the page (ticket 60's trap). An
 * unreadable source keeps its title rather than 404ing: the Draft's screen
 * sends the Author to the Journey page, and a Version's says it cannot be
 * read.
 */
export async function previewMetadata({
  projectId,
  journeyId,
  source,
  stepId,
}: {
  projectId: string;
  journeyId: string;
  source: PreviewSource;
  stepId?: string;
}): Promise<Metadata> {
  const journey = await loadJourney(projectId, journeyId);
  const stored = await loadStoredSource(
    projectId,
    journeyId,
    source.kind,
    source.kind === "version" ? source.versionNumber : undefined,
  );
  if (stored.kind === "missing") notFound();
  if (
    stepId !== undefined &&
    stored.kind === "ok" &&
    !hasStep(stored.document, stepId)
  ) {
    notFound();
  }

  if (source.kind === "draft") {
    return { title: `Preview: ${journey.title}` };
  }
  const title = stored.kind === "ok" ? stored.title : journey.title;
  return { title: `Preview: Version ${source.versionNumber}: ${title}` };
}

/**
 * Where a Step with a Prompt posts its form, for the Draft and for a
 * Version alike. Preview walks its source through the participant runner's
 * own components, so a prompted Step offers the same textbox and submit
 * buttons a Participant would see — and they have to post somewhere. This
 * is that somewhere, and it records nothing: it reads the answer with the
 * runner's own rule, so a required Prompt left blank is refused here
 * exactly as it would be live, and then it goes where the Choice leads.
 * Member-only like every Preview page; a non-Member is sent to the Journey
 * page, which 404s. A source that has gone unreadable since the screen
 * loaded sends the Author back to where that source is explained.
 */
export async function choosePreviewStep(
  projectId: string,
  journeyId: string,
  source: PreviewSource,
  stepId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) redirect(journeyHref);

  let document: GraphDocument;
  if (source.kind === "draft") {
    const stored = await getDraft(journey);
    if (!stored || stored.kind === "unreadable") redirect(journeyHref);
    document = stored.document;
  } else {
    const version = await getVersionByNumber(journey, source.versionNumber);
    if (!version || version.kind === "unreadable") {
      redirect(`${journeyHref}/versions/${source.versionNumber}`);
    }
    document = version.document;
  }

  const { base } = originFor(journeyHref, source);
  // A Step the source no longer has (a Draft edited in another tab; never
  // true of an immutable Version): back to the start of Preview, which is
  // where a stale link would land too.
  if (!hasStep(document, stepId)) redirect(base);

  const here = `${base}/${stepId}`;
  const reading = readResponse(
    document.steps[stepId],
    formData.get("response"),
  );
  const refused = refusalNotice(reading);
  if (refused) redirect(`${here}?notice=${refused}`);

  const to = formData.get("to");
  if (typeof to === "string" && hasStep(document, to))
    redirect(`${base}/${to}`);

  // An Ending's "Save response", or a stale Choice: the Author stays where
  // they are, told that nothing was recorded rather than left wondering.
  redirect(
    reading.kind === "answered" ? `${here}?notice=response-preview` : here,
  );
}
