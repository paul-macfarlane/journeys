import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Fragment } from "react";

import { RichText } from "@/components/runner/rich-text";
import { RunnerFrame } from "@/components/runner/runner-frame";
import { choiceLinkClassName } from "@/components/runner/step-view";
import {
  listPublicJourneysForProject,
  type PublicJourneySummary,
} from "@/db/journeys";
import { getPublicProject } from "@/db/projects";
import { listPublicAuthorsForProject } from "@/db/users";
import { isBlankContent } from "@/lib/graph/content";
import { projectLinkMetadata } from "@/lib/link-preview";
import { cn } from "@/lib/utils";

/**
 * The Project's live Journeys, request-scoped `cache()`d (ticket 42) for
 * the same reason `getPublicProject` is: `generateMetadata` and the page
 * both ask whether the Project has one, to decide the same 404, and this
 * way the render pays for one query rather than two.
 */
const getLiveJourneys = cache(
  (projectId: string): Promise<PublicJourneySummary[]> =>
    listPublicJourneysForProject(projectId),
);

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
 * are the live Published Version's, as the runner shows them. A Project
 * with no live Journey at all is a 404 here too (ticket 42, decision 4): a
 * link to a Project that has never published, or whose only Journey was
 * taken down, reads exactly as an unknown id does.
 *
 * Under the title, a "By …" line (ticket 52) names the Project's Members
 * whose Author page is on, in Members-tab order, each a link to that page;
 * nothing shows when none is.
 */

// Nothing here reads a cookie or a header, so without this Next would
// render the page once per id and keep serving that — and a Journey
// unpublished after the first visit would stay listed until the next deploy.
export const dynamic = "force-dynamic";

/**
 * What a link to this page previews as (ticket 37): the Project's title
 * and the opening of its description, with the card `opengraph-image.tsx`
 * beside this file renders in the Project's Theme. An unknown id, and a
 * Project with no live Journey, are both a 404 here (ticket 60, widened by
 * ticket 42): metadata streams in after the page, so a title returned for
 * either would replace the not-found page's own.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getPublicProject(projectId);
  if (!project) notFound();
  if ((await getLiveJourneys(projectId)).length === 0) notFound();
  return projectLinkMetadata(project, projectId);
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

  const [journeys, authors] = await Promise.all([
    getLiveJourneys(project.id),
    listPublicAuthorsForProject(project.id),
  ]);
  // No live Journey at all is a 404 too (ticket 42, decision 4): a Project
  // that never published and one whose only Journey was taken down both
  // read the same way an unknown id does, so a link says nothing about
  // whether the row exists.
  if (journeys.length === 0) notFound();

  return (
    // The Project's own Theme: a Journey's override is the Journey's, and
    // shows once a Participant follows its link. `home`: the wordmark
    // stands in for a Journey's title, since this page names no Journey.
    <RunnerFrame theme={project.theme} home>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.title}
        </h1>

        {authors.length > 0 ? (
          <p className="text-muted-foreground">
            By{" "}
            {authors.map((author, index) => (
              <Fragment key={author.id}>
                {index > 0 ? ", " : null}
                <a
                  href={`/authors/${author.id}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {author.name}
                </a>
              </Fragment>
            ))}
          </p>
        ) : null}

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
          {/* role="list" is explicit, as in the runner: the flex layout
              strips the list marker, and some browsers drop the implicit
              role with it. Plain anchors, like every runner navigation —
              the page ships no client bundle. At least one Journey is
              guaranteed here: a Project with none has already 404'd. */}
          <ul role="list" aria-label="Journeys" className="flex flex-col gap-2">
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
        </section>
      </div>
    </RunnerFrame>
  );
}
