import type { Metadata } from "next";
import Link from "next/link";

import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listProjectsForUser } from "@/lib/projects";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your projects",
};

export default async function ProjectsPage() {
  const session = await requireSession();
  const projects = await listProjectsForUser(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Your projects
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {session.user.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewProjectDialog />
          <SignOutButton />
        </div>
      </header>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Projects you create or are added to as a member will appear here,
              each holding its own journeys.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      ) : (
        // role="list" is explicit: the flex layout below strips the list
        // marker, and some browsers drop the implicit role with it.
        <ul role="list" className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.slug}`}
                className="flex flex-col gap-1 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"
              >
                <span className="font-medium">{project.title}</span>
                <span className="text-muted-foreground text-sm">
                  /projects/{project.slug}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
