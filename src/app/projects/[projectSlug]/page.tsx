import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { RenameProjectDialog } from "@/components/projects/rename-project-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProjectForMember } from "@/lib/projects";
import { requireSession } from "@/lib/session";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const session = await requireSession();
  const { projectSlug } = await params;

  // Null for a non-Member and for a slug that never existed alike, so both
  // get the same 404 and neither leaks the other's existence.
  const project = await getProjectForMember(projectSlug, session.user.id);
  if (!project) notFound();

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
          <p className="text-muted-foreground text-sm">
            /projects/{project.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RenameProjectDialog title={project.title} slug={project.slug} />
          <DeleteProjectDialog title={project.title} slug={project.slug} />
        </div>
      </header>

      {/* Journeys: D2 of ticket 02 replaces this empty state with the real
          list and a "New journey" dialog. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Journeys</h2>
        <Card>
          <CardHeader>
            <CardTitle>No journeys yet</CardTitle>
            <CardDescription>
              Journeys you author in this project will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </section>
    </main>
  );
}
