import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CannotBeRead } from "@/components/cannot-be-read";
import {
  PublishAcknowledgement,
  PublishScope,
} from "@/components/journeys/publish-controls";
import { RestoreVersionDialog } from "@/components/journeys/restore-version-dialog";
import { VersionStepPanel } from "@/components/journeys/version-step-panel";
import { VersionView } from "@/components/journeys/version-view";
import { LocalTime } from "@/components/local-time";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { journeyForMember } from "@/db/access";
import { getDraft } from "@/db/drafts";
import { getLiveVersion, getVersionByNumber } from "@/db/versions";
import { draftPending } from "@/lib/publish-state";
import { requireSession } from "@/lib/session";
import { parseVersionNumber } from "@/lib/version-number";

type Params = Promise<{
  projectId: string;
  journeyId: string;
  versionNumber: string;
}>;

/**
 * The Journey and the Version the address names, for the page and its
 * metadata alike, or null for everything that 404s: a non-Member, an
 * unknown Project or Journey, an address that is no Version number, and a
 * number this Journey has no Version by. `requireSession` and
 * `journeyForMember` are `cache()`d, so the page pays the membership query
 * once.
 */
async function resolve(params: Params) {
  const session = await requireSession();
  const { projectId, journeyId, versionNumber } = await params;
  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) return null;
  const number = parseVersionNumber(versionNumber);
  if (number === null) return null;
  const version = await getVersionByNumber(journey, number);
  if (!version) return null;
  return { projectId, journey, version };
}

/**
 * "Version 1: <title>", the title the Version was published with (the
 * Journey's own for one that cannot be read), with the root layout's
 * template appending "· Journeys". Everything the page 404s on 404s here
 * too (ticket 60): metadata streams in after the page, so a title returned
 * here would replace the not-found page's own.
 */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  const { journey, version } = resolved;
  const title = version.kind === "ok" ? version.title : journey.title;
  return { title: `Version ${version.versionNumber}: ${title}` };
}

/**
 * One Published Version, looked at on its own (ticket 94): its map, the
 * selected Step's content, and a Restore that puts it back in the Draft.
 * Nothing here edits it — a Published Version is immutable.
 */
export default async function VersionPage({ params }: { params: Params }) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  const { projectId, journey, version } = resolved;

  // The Draft's version guards the Restore (ticket 73), as on the Journey
  // page; a Journey with no Draft row gets that page's 404.
  const stored = await getDraft(journey);
  if (!stored) notFound();
  const live = await getLiveVersion(journey);
  const { hasUnpublishedChanges } = draftPending({
    journey,
    draft: {
      document: stored.kind === "ok" ? stored.document : null,
      updatedAt: stored.updatedAt,
    },
    live,
  });

  const title = version.kind === "ok" ? version.title : journey.title;

  return (
    <>
      <PublishScope
        hasUnpublishedChanges={hasUnpublishedChanges}
        draftVersion={stored.version}
      >
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-12">
          <div>
            <Link
              href={`/projects/${projectId}/journeys/${journey.id}?tab=versions`}
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              ← Back to versions
            </Link>
          </div>

          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
              <h1 className="text-2xl font-semibold break-words">
                Version {version.versionNumber}: {title}
              </h1>
              {version.kind === "ok" ? (
                <>
                  {version.description.trim().length > 0 ? (
                    <p className="text-muted-foreground break-words">
                      {version.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {version.isLive ? <Badge>Live</Badge> : null}
                    <span className="text-muted-foreground">
                      Published <LocalTime instant={version.publishedAt} /> by{" "}
                      {version.publishedByName ?? "a former member"}
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            {version.kind === "ok" ? (
              // The row a Preview of this Version will join (ticket 94, D2).
              <div className="flex flex-wrap items-center justify-end gap-2">
                <RestoreVersionDialog
                  projectId={projectId}
                  journeyId={journey.id}
                  versionId={version.id}
                  versionNumber={version.versionNumber}
                />
                <PublishAcknowledgement journeyId={journey.id} />
              </div>
            ) : null}
          </header>

          {version.kind === "ok" ? (
            <VersionView
              document={version.document}
              panels={Object.fromEntries(
                Object.values(version.document.steps).map((step) => [
                  step.id,
                  <VersionStepPanel
                    key={step.id}
                    document={version.document}
                    step={step}
                  />,
                ]),
              )}
            />
          ) : (
            <CannotBeRead
              title={`Version ${version.versionNumber} can't be read`}
            >
              <p>
                {`Version ${version.versionNumber} is stored in a shape the map can’t read, so it can’t be shown or restored. The other versions are unaffected.`}
              </p>
            </CannotBeRead>
          )}
        </main>
      </PublishScope>
      <SiteFooter />
    </>
  );
}
