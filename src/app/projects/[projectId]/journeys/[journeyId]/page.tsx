import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteJourneyDialog } from "@/components/journeys/delete-journey-dialog";
import { EditJourneyDialog } from "@/components/journeys/edit-journey-dialog";
import { JourneyStatusBadge } from "@/components/journeys/journey-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

      {/* Draft: the step-and-choice editor arrives with ticket 03. Until
          then a Journey has no content to author beyond this metadata. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Draft</h2>
        <Card>
          <CardHeader>
            <CardTitle>The editor isn&apos;t built yet</CardTitle>
            <CardDescription>
              Authoring the graph of steps and choices arrives with a later
              ticket.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </section>
    </main>
  );
}
