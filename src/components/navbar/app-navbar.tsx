import Link from "next/link";

import { ProjectSwitcher } from "@/components/navbar/project-switcher";
import { UserMenu } from "@/components/navbar/user-menu";
import {
  getProjectForMember,
  listRecentProjectsForAuthor,
} from "@/db/projects";
import { SWITCHER_LIMIT, switcherProjects } from "@/lib/navbar";
import { requireSession } from "@/lib/session";

/**
 * The bar above every signed-in Author page (ticket 29): the app name, the
 * Project switcher, and the user menu. The runner and the sign-in page keep
 * their own frames and never render it.
 *
 * A server component: it reads the session and the Author's Projects here,
 * and hands the two menus — the only interactive parts — plain data. It is
 * rendered by the layouts under `/projects`; the one beneath `[projectId]`
 * passes the id so the switcher can name the page's own Project.
 *
 * One row at every width: the switcher's label truncates and the user
 * menu's name hides at phone width, so nothing wraps and nothing pushes the
 * page sideways.
 */
export async function AppNavbar({ projectId }: { projectId?: string }) {
  const session = await requireSession();

  // A non-Member gets null here and a 404 from the page; the bar still
  // renders, labelled as it is anywhere outside a Project.
  const [recent, current] = await Promise.all([
    listRecentProjectsForAuthor(session.user.id, SWITCHER_LIMIT),
    projectId ? getProjectForMember(projectId, session.user.id) : null,
  ]);
  const currentProject = current
    ? { id: current.id, title: current.title }
    : null;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <nav aria-label="App" className="flex min-w-0 items-center gap-1">
          <Link
            href="/projects"
            className="shrink-0 px-2 text-sm font-semibold tracking-tight"
          >
            Journeys
          </Link>
          <ProjectSwitcher
            projects={switcherProjects(recent, currentProject)}
            currentId={currentProject?.id ?? null}
            label={currentProject?.title ?? "Projects"}
          />
        </nav>
        <UserMenu
          user={{
            name: session.user.name,
            email: session.user.email,
            image: session.user.image ?? null,
          }}
        />
      </div>
    </header>
  );
}
