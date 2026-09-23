import { APP_NAME } from "@/lib/brand";
import { getPublicProject } from "@/db/projects";
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
 * app mark, in the Project's own Theme. An unknown id gets the site's own
 * card. Rendered on every request, like the page, with the same short
 * `Cache-Control` the Journey card carries.
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

  return ogResponse(
    project ? (
      <LinkPreviewCard
        kicker={APP_NAME}
        title={project.title}
        description={contentPreview(
          project.description,
          LINK_PREVIEW_DESCRIPTION_LIMIT,
        )}
        palette={linkPreviewPalette(project.theme)}
      />
    ) : (
      <BrandCard />
    ),
    { cacheControl: OG_CACHE_CONTROL },
  );
}
