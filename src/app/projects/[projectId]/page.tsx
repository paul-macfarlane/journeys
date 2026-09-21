import Link from "next/link";
import { notFound } from "next/navigation";

import { JourneyStatusBadge } from "@/components/journeys/journey-status-badge";
import { NewJourneyDialog } from "@/components/journeys/new-journey-dialog";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { MemberList } from "@/components/projects/member-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listJourneysForProject } from "@/db/journeys";
import { listMembers } from "@/db/members";
import { getProjectForMember } from "@/db/projects";
import { requireSession } from "@/lib/session";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireSession();
  const { projectId } = await params;

  // Null for a non-Member and for an id that never existed alike, so both
  // get the same 404 and neither leaks the other's existence.
  const project = await getProjectForMember(projectId, session.user.id);
  if (!project) notFound();

  const [journeys, members] = await Promise.all([
    listJourneysForProject(project.id),
    listMembers(project.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <Link
          href="/projects"
          className="text-muted-foreground text-sm hover:text-foreground"
        >
          ← Your projects
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <EditProjectDialog projectId={project.id} title={project.title} />
          <DeleteProjectDialog projectId={project.id} title={project.title} />
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-medium tracking-tight">Journeys</h2>
          <NewJourneyDialog projectId={project.id} />
        </div>

        {journeys.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No journeys yet</CardTitle>
              <CardDescription>
                Journeys you author in this project will appear here.
              </CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ) : (
          // role="list" is explicit: the flex layout below strips the list
          // marker, and some browsers drop the implicit role with it.
          <ul role="list" className="flex flex-col gap-3">
            {journeys.map((journey) => (
              <li key={journey.id}>
                <Link
                  href={`/projects/${project.id}/journeys/${journey.id}`}
                  className="flex flex-col gap-1 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{journey.title}</span>
                    <JourneyStatusBadge publishState={journey.publishState} />
                  </div>
                  {journey.description ? (
                    <p className="text-muted-foreground text-sm">
                      {journey.description}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MemberList
        projectId={project.id}
        currentUserId={session.user.id}
        members={members}
      />
    </main>
  );
}
