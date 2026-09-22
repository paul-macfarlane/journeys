import { AppNavbar } from "@/components/navbar/app-navbar";

/**
 * The navbar above the Projects list. It is a sibling of the layout under
 * `[projectId]` rather than one layout over both: a layout only ever sees
 * its own segment's params, so the switcher can name the page's Project
 * only from a layout that sits beneath `[projectId]`. Two layouts, one
 * navbar each, and every Author page gets exactly one — so a new route
 * belongs inside `(list)` or `[projectId]`; one placed straight under
 * `projects/` would get no navbar at all.
 */
export default function ProjectsListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppNavbar />
      {children}
    </>
  );
}
