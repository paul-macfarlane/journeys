import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteJourneyDialog } from "@/components/journeys/delete-journey-dialog";
import { DraftSummary } from "@/components/journeys/draft-summary";
import { EditJourneyDialog } from "@/components/journeys/edit-journey-dialog";
import { JourneyStatusBadge } from "@/components/journeys/journey-status-badge";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { requireSession } from "@/lib/session";

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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
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
          <JourneyStatusBadge />
        </div>
        <div className="flex items-center gap-2">
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

      <DraftSummary draft={draft} />
    </main>
  );
}
