import { AppNavbar } from "@/components/navbar/app-navbar";

/**
 * The navbar above a Project and everything inside it — its Journeys and
 * their Previews. Sits beneath `[projectId]` so it can hand the switcher
 * the page's own Project (see the sibling layout under `(list)`). The page
 * still does its own Member check; the layout renders in parallel with it
 * and only decides what the bar is labelled.
 *
 * No footer here, unlike the `(list)` layout: the Preview pages beneath
 * this segment render `RunnerFrame`, which carries the site footer inside
 * the themed frame, and a second one under it would be two `contentinfo`
 * landmarks on one page. The Project and Journey pages render their own.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <>
      <AppNavbar projectId={projectId} />
      {children}
    </>
  );
}
