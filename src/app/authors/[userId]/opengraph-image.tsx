import { getPublicAuthor } from "@/db/users";
import { APP_NAME } from "@/lib/brand";
import { textPreview } from "@/lib/graph/content";
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
 * An Author's link-preview image (ticket 52), served at
 * `/authors/<id>/opengraph-image` and linked as og:image from the public
 * Author page: the Author's name and the opening of their bio under the
 * app mark, in the app's own Theme. An unknown id and an Author whose page
 * is off both get the site's own card. Rendered on every request, like the
 * page, with the same short `Cache-Control` the Project card carries.
 */
export const dynamic = "force-dynamic";

export const alt = `An author on ${APP_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function AuthorOpenGraphImage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const author = await getPublicAuthor(userId);

  return ogResponse(
    (face) =>
      author ? (
        <LinkPreviewCard
          face={face}
          kicker="Author"
          title={author.name}
          description={textPreview(author.bio, LINK_PREVIEW_DESCRIPTION_LIMIT)}
          palette={linkPreviewPalette({ preset: "trail", accent: null })}
        />
      ) : (
        <BrandCard face={face} />
      ),
    { cacheControl: OG_CACHE_CONTROL },
  );
}
