import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteJourneyDialog } from "@/components/journeys/delete-journey-dialog";
import { DraftEditor } from "@/components/journeys/draft-editor";
import { EditJourneyDialog } from "@/components/journeys/edit-journey-dialog";
import { JourneyStatusBadge } from "@/components/journeys/journey-status-badge";
import { PublishControls } from "@/components/journeys/publish-controls";
import { VersionList } from "@/components/journeys/version-list";
import { buttonVariants } from "@/components/ui/button";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { getLiveVersion, listVersionsForMember } from "@/db/versions";
import { documentsEqual } from "@/lib/graph/document";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function JourneyPage({
  params,
}: {
  params: Promise<{ projectId: string; journeyId: string }>;
}) {
  const session = await requireSession();
  const { projectId, journeyId } = await params;

  // Null for a non-Member, an unknown Project, and an unknown Journey
  // alike, so all three get the same 404.
  const journey = await getJourneyForMember(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!journey) notFound();

  // Every Journey has a Draft, created with it — a missing one is a Journey
  // that cannot be authored, so it gets the same 404 rather than a page with
  // a hole in it.
  const draft = await getDraftForMember(projectId, journeyId, session.user.id);
  if (!draft) notFound();

  // Null only for a non-Member, which the check above already answered; an
  // empty list is a Journey that has never been published.
  const versions = await listVersionsForMember(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!versions) notFound();

  // Publish has nothing to do while participants already see exactly this:
  // the Draft, the title, and the description. An unpublished or
  // never-published Journey always has something to publish.
  const live = await getLiveVersion(projectId, journeyId, session.user.id);
  const hasUnpublishedChanges =
    live === null ||
    live.title !== journey.title ||
    live.description !== journey.description ||
    !documentsEqual(draft, live.document);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="text-muted-foreground text-sm hover:text-foreground"
        >
          ← Back to project
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {journey.title}
          </h1>
          <JourneyStatusBadge publishState={journey.publishState} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/journeys/${journey.id}/preview`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Preview
          </Link>
          <EditJourneyDialog
            projectId={projectId}
            journeyId={journey.id}
            title={journey.title}
            description={journey.description}
          />
          <DeleteJourneyDialog
            projectId={projectId}
            journeyId={journey.id}
            title={journey.title}
          />
        </div>
      </header>

      {journey.description ? (
        <p className="text-muted-foreground">{journey.description}</p>
      ) : null}

      <PublishControls
        projectId={projectId}
        journeyId={journey.id}
        publishState={journey.publishState}
        hasUnpublishedChanges={hasUnpublishedChanges}
      />

      <DraftEditor projectId={projectId} journeyId={journey.id} draft={draft} />

      <VersionList
        projectId={projectId}
        journeyId={journey.id}
        versions={versions}
      />
    </main>
  );
}
