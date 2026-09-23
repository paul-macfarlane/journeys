import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RichText } from "@/components/runner/rich-text";
import { RunnerFrame } from "@/components/runner/runner-frame";
import { choiceLinkClassName } from "@/components/runner/step-view";
import { listPublicJourneysForProject } from "@/db/journeys";
import { getPublicProject } from "@/db/projects";
import { isBlankContent } from "@/lib/graph/content";
import { projectLinkMetadata } from "@/lib/link-preview";
import { cn } from "@/lib/utils";

/**
 * The public Project page (ticket 07): a Project's title, its rich-text
 * description, and the Journeys in it that are live to Participants, each a
 * link into the runner. Public and anonymous, like the runner it sits
 * beside: no session, no membership, no account — a Participant only ever
 * needs the link, and there is no index, search, or browsing that would
 * lead here without one.
 *
 * Publishing is the only visibility there is. A Journey is listed while its
 * live pointer is set and absent otherwise, whether it was never published
 * or was taken down; the page is rendered on every request, so unpublishing
 * shows the moment it happens and needs no deploy. Titles and descriptions
 * are the live Published Version's, as the runner shows them.
 */

// Nothing here reads a cookie or a header, so without this Next would
// render the page once per id and keep serving that — and a Journey
// unpublished after the first visit would stay listed until the next deploy.
export const dynamic = "force-dynamic";

/**
 * What a link to this page previews as (ticket 37): the Project's title
 * and the opening of its description, with the card `opengraph-image.tsx`
 * beside this file renders in the Project's Theme. The page answers an
 * unknown id with a 404, and its metadata reads as the site root does.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  return projectLinkMetadata(await getPublicProject(projectId), projectId);
}

export default async function PublicProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getPublicProject(projectId);
  // An unknown id is a 404, the same answer it gets anywhere else.
  if (!project) notFound();

  const journeys = await listPublicJourneysForProject(project.id);

  return (
    // The Project's own Theme: a Journey's override is the Journey's, and
    // shows once a Participant follows its link.
    <RunnerFrame theme={project.theme}>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.title}
        </h1>

        {/* A blank description — none written, or one cleared back to an
            empty paragraph — shows nothing rather than an empty block. */}
        {isBlankContent(project.description) ? null : (
          <RichText content={project.description} />
        )}

        <section
          aria-labelledby="journeys-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="journeys-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Journeys
          </h2>
          {journeys.length === 0 ? (
            <p className="text-muted-foreground">
              No journeys are available right now.
            </p>
          ) : (
            // role="list" is explicit, as in the runner: the flex layout
            // strips the list marker, and some browsers drop the implicit
            // role with it. Plain anchors, like every runner navigation —
            // the page ships no client bundle.
            <ul
              role="list"
              aria-label="Journeys"
              className="flex flex-col gap-2"
            >
              {journeys.map((journey) => (
                <li key={journey.id}>
                  <a
                    href={`/j/${journey.id}`}
                    className={cn(
                      choiceLinkClassName,
                      "flex-col items-start gap-0.5",
                    )}
                  >
                    <span className="font-medium">{journey.title}</span>
                    {journey.description ? (
                      <span className="text-muted-foreground text-sm font-normal">
                        {journey.description}
                      </span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </RunnerFrame>
  );
}
