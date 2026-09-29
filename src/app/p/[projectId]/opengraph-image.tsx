import { listPublicJourneysForProject } from "@/db/journeys";
import { getPublicProject } from "@/db/projects";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { contentPreview } from "@/lib/graph/content";
import {
  LINK_PREVIEW_DESCRIPTION_LIMIT,
  linkPreviewPalette,
} from "@/lib/link-preview";
import {
  BrandCard,
  LinkPreviewCard,
  OG_CACHE_CONTROL,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogResponse,
} from "@/lib/og";

/**
 * A Project's link-preview image (ticket 37), served at
 * `/p/<id>/opengraph-image` and linked as og:image from the public Project
 * page: the Project's title and the opening of its description under the
 * app mark, in the Project's own Theme. An unknown id, and a Project with
 * no live Journey (ticket 42, decision 4 — the same 404 the page itself
 * answers with), both get the site's own card, so the image reveals
 * nothing a Participant is not shown. The description falls back to the
 * app's own tagline when the Project has written none, exactly as
 * `projectLinkMetadata` does for the page's own metadata. Rendered on every
 * request, like the page, with the same short `Cache-Control` the Journey
 * card carries.
 */
export const dynamic = "force-dynamic";

export const alt = `A project on ${APP_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function ProjectOpenGraphImage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getPublicProject(projectId);
  const hasLiveJourney =
    project !== null &&
    (await listPublicJourneysForProject(projectId)).length > 0;
  const preview = project
    ? contentPreview(project.description, LINK_PREVIEW_DESCRIPTION_LIMIT)
    : "";

  return ogResponse(
    (face) =>
      project && hasLiveJourney ? (
        <LinkPreviewCard
          face={face}
          kicker={APP_NAME}
          title={project.title}
          description={preview.length > 0 ? preview : APP_TAGLINE}
          palette={linkPreviewPalette(project.theme)}
        />
      ) : (
        <BrandCard face={face} />
      ),
    { cacheControl: OG_CACHE_CONTROL },
  );
}
