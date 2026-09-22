import Link from "next/link";
import { notFound } from "next/navigation";

import { NewJourneyDialog } from "@/components/journeys/new-journey-dialog";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { JourneyList } from "@/components/projects/journey-list";
import { MemberList } from "@/components/projects/member-list";
import { ProjectSettingsFields } from "@/components/projects/project-settings-fields";
import { UrlTabs } from "@/components/url-tabs";
import { listJourneysForProject } from "@/db/journeys";
import { listMembers } from "@/db/members";
import { getProjectForMember } from "@/db/projects";
import { requireSession } from "@/lib/session";
import { readTab } from "@/lib/tabs";

/** The page's sections, the first being what the plain address opens on. */
const PROJECT_TABS = ["journeys", "members", "settings"] as const;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await requireSession();
  const [{ projectId }, { tab }] = await Promise.all([params, searchParams]);

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

      {/* The title and description are edited on the Settings tab; here
          they are the page's heading. */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.title}
        </h1>
        {project.description ? (
          <p className="text-muted-foreground">{project.description}</p>
        ) : null}
      </header>

      <UrlTabs
        label="Project"
        initialTab={readTab(PROJECT_TABS, tab)}
        tabs={[
          {
            value: "journeys",
            label: "Journeys",
            content: (
              <div className="flex flex-col gap-4">
                <div className="flex justify-end">
                  <NewJourneyDialog projectId={project.id} />
                </div>
                <JourneyList projectId={project.id} journeys={journeys} />
              </div>
            ),
          },
          {
            value: "members",
            label: "Members",
            content: (
              <MemberList
                projectId={project.id}
                currentUserId={session.user.id}
                members={members}
              />
            ),
          },
          {
            value: "settings",
            label: "Settings",
            content: (
              <section aria-label="Settings" className="flex flex-col gap-8">
                <ProjectSettingsFields
                  projectId={project.id}
                  title={project.title}
                  description={project.description}
                />

                <section
                  aria-labelledby="danger-zone"
                  className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-destructive/30"
                >
                  <h2 id="danger-zone" className="font-medium">
                    Danger zone
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Deleting the project deletes every journey in it, for every
                    member.
                  </p>
                  <div>
                    <DeleteProjectDialog
                      projectId={project.id}
                      title={project.title}
                    />
                  </div>
                </section>
              </section>
            ),
          },
        ]}
      />
    </main>
  );
}
