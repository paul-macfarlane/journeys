// Server-only data loading — `server-only` so a client import fails the build.
import "server-only";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  loadPreviewSource,
  previewMetadata,
  type PreviewResult,
} from "../../../preview/source";
import { parseVersionNumber } from "@/lib/version-number";

/**
 * A Published Version's Preview screens start from the same place as the
 * Draft's (`@/…/preview/load.ts`) but by version number: an address that is
 * no Version number at all 404s here, exactly as the Version's own view
 * does (ticket 94), before `loadPreviewSource` resolves the rest — a
 * non-Member, an unknown Journey, and a number this Journey has none by.
 * Unlike the Draft, a Version that cannot be read is not a 404: the caller
 * gets an `unreadable` result back and renders a `CannotBeRead` itself.
 */
export async function loadVersionPreview({
  projectId,
  journeyId,
  versionNumber,
}: {
  projectId: string;
  journeyId: string;
  versionNumber: string;
}): Promise<PreviewResult> {
  const number = parseVersionNumber(versionNumber);
  if (number === null) notFound();

  return loadPreviewSource({
    projectId,
    journeyId,
    source: { kind: "version", versionNumber: number },
  });
}

/**
 * Both Version Preview screens' tab title: "Preview: Version <n>: <version
 * title>", with the root layout's template appending "· Journeys". Same
 * 404 rules as `loadVersionPreview`, plus a Step the Version does not have
 * on a Step screen (`stepId`) — metadata streams in after the page (ticket
 * 60's trap).
 */
export async function versionPreviewMetadata({
  projectId,
  journeyId,
  versionNumber,
  stepId,
}: {
  projectId: string;
  journeyId: string;
  versionNumber: string;
  stepId?: string;
}): Promise<Metadata> {
  const number = parseVersionNumber(versionNumber);
  if (number === null) notFound();

  return previewMetadata({
    projectId,
    journeyId,
    source: { kind: "version", versionNumber: number },
    stepId,
  });
}
