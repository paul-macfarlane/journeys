import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RunnerFrame } from "@/components/runner/runner-frame";
import { choiceLinkClassName } from "@/components/runner/step-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPublicAuthor, listPublicProjectsForAuthor } from "@/db/users";
import { authorLinkLabel } from "@/lib/author";
import { contentPreview } from "@/lib/graph/content";
import { authorLinkMetadata } from "@/lib/link-preview";
import { initials } from "@/lib/navbar";
import { cn } from "@/lib/utils";

/**
 * The public Author page (ticket 52): an Author's avatar, name, bio, and
 * links, and the Projects they are a Member of that have a published
 * Journey, each a link to that Project's public page. Public and anonymous,
 * like the Project page and the runner: no session, no membership, no
 * account.
 *
 * Opt-in. The page exists only while the Author has turned it on with the
 * switch on Settings; off, it is a 404 identical to an unknown id's, so a
 * link to it says nothing about whether the account exists. The page is
 * rendered on every request, so turning it off shows the moment it happens.
 *
 * Painted in the app's own Theme (`trail`): an Author belongs to no one
 * Project, so no Project's Theme is theirs.
 */

// Nothing here reads a cookie or a header, so without this Next would
// render the page once per id and keep serving it after the Author turned
// it off.
export const dynamic = "force-dynamic";

/**
 * What a link to this page previews as: the Author's name and the opening
 * of their bio, with the card `opengraph-image.tsx` beside this file
 * renders. Unknown and off are a 404 here too (ticket 60): metadata
 * streams in after the page, so a title returned for a missing Author
 * would replace the not-found page's own.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const author = await getPublicAuthor(userId);
  if (!author) notFound();
  return authorLinkMetadata(author, userId);
}

export default async function PublicAuthorPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const author = await getPublicAuthor(userId);
  // Unknown and off are the same 404.
  if (!author) notFound();

  const projects = await listPublicProjectsForAuthor(author.id);

  return (
    <RunnerFrame theme={{ preset: "trail", accent: null }}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16" aria-hidden>
            {author.image ? <AvatarImage src={author.image} alt="" /> : null}
            <AvatarFallback>{initials(author.name)}</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-semibold tracking-tight">
            {author.name}
          </h1>
        </div>

        {/* The bio keeps the line breaks the Author typed. */}
        {author.bio ? (
          <p className="whitespace-pre-line">{author.bio}</p>
        ) : null}

        {author.links.length > 0 ? (
          <nav aria-label="Links">
            <ul role="list" className="flex flex-wrap gap-x-4 gap-y-2">
              {author.links.map((link) => (
                <li key={link.kind}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 underline underline-offset-4"
                  >
                    <LinkIcon aria-hidden className="size-4" />
                    {authorLinkLabel(link.kind)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <section
          aria-labelledby="projects-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="projects-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Projects
          </h2>
          {projects.length === 0 ? (
            <p className="text-muted-foreground">No published journeys yet.</p>
          ) : (
            // role="list" is explicit, as on the Project page: the flex
            // layout strips the list marker, and some browsers drop the
            // implicit role with it. Plain anchors, like every runner
            // navigation.
            <ul
              role="list"
              aria-label="Projects"
              className="flex flex-col gap-2"
            >
              {projects.map((project) => {
                const preview = contentPreview(project.description);
                return (
                  <li key={project.id}>
                    <a
                      href={`/p/${project.id}`}
                      className={cn(
                        choiceLinkClassName,
                        "flex-col items-start gap-0.5",
                      )}
                    >
                      <span className="font-medium">{project.title}</span>
                      {preview ? (
                        <span className="text-muted-foreground text-sm font-normal">
                          {preview}
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </RunnerFrame>
  );
}
