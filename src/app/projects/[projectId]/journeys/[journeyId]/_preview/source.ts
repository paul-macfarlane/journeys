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
import { isVersionNumber, parseVersionNumber } from "@/lib/version-number";

/**
 * What Preview walks (ticket 94): the Draft, or one Published Version by
 * its number. Both route pairs — `.../preview` and
 * `.../versions/<n>/preview` — share this module's loaders and action, and
 * `./screens`' bodies, so the two surfaces cannot drift: what differs
 * between walking the Draft and walking a Version is the source of the
 * graph and the way back, never the runner around it. A private folder
 * (`_preview`), so Next routes none of it.
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
 * `CannotBeRead` — so this only reports it. Primitive arguments, so the
 * page and its metadata share one read.
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

function readSource(
  projectId: string,
  journeyId: string,
  source: PreviewSource,
) {
  return loadStoredSource(
    projectId,
    journeyId,
    source.kind,
    source.kind === "version" ? source.versionNumber : undefined,
  );
}

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

/** Everything a Preview screen (`./screens`) draws from, for either source. */
export type PreviewLoaded = {
  source: PreviewSource;
  document: GraphDocument;
  /** The Journey's own for the Draft, the Version's own for a Version. */
  title: string;
  description: string;
  /** The Theme a Participant will see: the Journey's override, else its Project's. */
  theme: Theme;
  /** The Author's Project page, the header's way out (ticket 69). */
  project: { title: string; href: string };
  base: string;
  backHref: string;
  backLabel: string;
};

/**
 * The source, loaded for the signed-in Member — a non-Member, an unknown
 * Journey, and a missing source all 404 — or `unreadable` when its row
 * fails its document contract; the callers below decide what that means.
 */
async function loadPreviewSource(
  projectId: string,
  journeyId: string,
  source: PreviewSource,
): Promise<{ kind: "ok"; loaded: PreviewLoaded } | { kind: "unreadable" }> {
  const journey = await loadJourney(projectId, journeyId);
  const journeyHref = `/projects/${projectId}/journeys/${journeyId}`;

  const stored = await readSource(projectId, journeyId, source);
  if (stored.kind === "missing") notFound();
  if (stored.kind === "unreadable") return { kind: "unreadable" };

  return {
    kind: "ok",
    loaded: {
      source,
      document: stored.document,
      title: stored.title,
      description: stored.description,
      theme: effectiveTheme(journey.project.theme, journey.theme),
      project: { title: journey.project.title, href: `/projects/${projectId}` },
      ...originFor(journeyHref, source),
    },
  };
}

/**
 * What the Draft's Preview screens start from (ticket 82): the Journey,
 * resolved for the signed-in Member — a non-Member and an unknown Journey
 * both 404 — its Draft, and the Theme a Participant will see, so an Author
 * sees the look along with the words. A Draft that cannot be read has
 * nothing to preview: the Journey page says so and offers a Restore
 * (ticket 73), so this sends the Author there.
 */
export async function loadDraftPreview({
  projectId,
  journeyId,
}: {
  projectId: string;
  journeyId: string;
}): Promise<PreviewLoaded> {
  const result = await loadPreviewSource(projectId, journeyId, {
    kind: "draft",
  });
  if (result.kind === "unreadable") {
    redirect(`/projects/${projectId}/journeys/${journeyId}`);
  }
  return result.loaded;
}

export type VersionPreviewResult =
  | { kind: "ok"; versionNumber: number; loaded: PreviewLoaded }
  /**
   * A Published Version whose row cannot be read (ticket 83's pattern):
   * both Version Preview routes still answer 200 and say so, rather than
   * crashing or redirecting in a loop.
   */
  | { kind: "unreadable"; versionNumber: number; viewHref: string };

/**
 * A Published Version's Preview screens start from the same place as the
 * Draft's, but by version number: an address that is no Version number at
 * all 404s here, exactly as the Version's own view does, before the rest
 * is resolved — a non-Member, an unknown Journey, and a number this
 * Journey has none by. Unlike the Draft, a Version that cannot be read is
 * not bounced: the Journey page never 404s on it, so this reports it and
 * the page renders a `CannotBeRead` itself.
 */
export async function loadVersionPreview({
  projectId,
  journeyId,
  versionNumber: segment,
}: {
  projectId: string;
  journeyId: string;
  versionNumber: string;
}): Promise<VersionPreviewResult> {
  const versionNumber = parseVersionNumber(segment);
  if (versionNumber === null) notFound();

  const result = await loadPreviewSource(projectId, journeyId, {
    kind: "version",
    versionNumber,
  });
  if (result.kind === "unreadable") {
    return {
      kind: "unreadable",
      versionNumber,
      viewHref: `/projects/${projectId}/journeys/${journeyId}/versions/${versionNumber}`,
    };
  }
  return { kind: "ok", versionNumber, loaded: result.loaded };
}

/**
 * Every Preview screen's tab title, with the root layout's template
 * appending "· Journeys": "Preview: <Journey title>" for the Draft (ticket
 * 91), "Preview: Version <n>: <version title>" for a Version (the Journey's
 * own title when that Version cannot be read). Everything the screen itself
 * 404s on 404s here too — a non-Member, an unknown Journey, a missing
 * source, and on a Step screen (`stepId`) a Step the source does not have —
 * since metadata streams in after the page (ticket 60's trap). An
 * unreadable source keeps its title rather than 404ing: the Draft's screen
 * sends the Author to the Journey page, and a Version's says it cannot be
 * read.
 */
async function previewMetadata(
  projectId: string,
  journeyId: string,
  source: PreviewSource,
  stepId: string | undefined,
): Promise<Metadata> {
  const journey = await loadJourney(projectId, journeyId);
  const stored = await readSource(projectId, journeyId, source);
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

/** The Draft's Preview screens' tab title; see `previewMetadata`. */
export function draftPreviewMetadata({
  projectId,
  journeyId,
  stepId,
}: {
  projectId: string;
  journeyId: string;
  stepId?: string;
}): Promise<Metadata> {
  return previewMetadata(projectId, journeyId, { kind: "draft" }, stepId);
}

/**
 * A Version's Preview screens' tab title; see `previewMetadata`. An
 * address that is no Version number 404s, as `loadVersionPreview` does.
 */
export async function versionPreviewMetadata({
  projectId,
  journeyId,
  versionNumber: segment,
  stepId,
}: {
  projectId: string;
  journeyId: string;
  versionNumber: string;
  stepId?: string;
}): Promise<Metadata> {
  const versionNumber = parseVersionNumber(segment);
  if (versionNumber === null) notFound();
  return previewMetadata(
    projectId,
    journeyId,
    { kind: "version", versionNumber },
    stepId,
  );
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
 * page, which 404s. A Version number is a bound argument the client
 * controls, so one that is no Version number goes there too, before the
 * database is asked. A source that has gone unreadable since the screen
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

  if (source.kind === "version" && !isVersionNumber(source.versionNumber)) {
    redirect(journeyHref);
  }

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
