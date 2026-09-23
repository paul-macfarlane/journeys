import { APP_NAME } from "@/lib/brand";
import { getPublicJourney } from "@/db/runs";
import { linkPreviewPalette } from "@/lib/link-preview";
import {
  BrandCard,
  LinkPreviewCard,
  OG_CACHE_CONTROL,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogResponse,
} from "@/lib/og";

/**
 * A Journey's link-preview image (ticket 37), served at
 * `/j/<id>/opengraph-image` and linked as og:image from the Journey's
 * pages: the live Published Version's title and description with the
 * Project's title and the app mark, in the Journey's Theme colours — what a
 * Participant following the link would see. Never the Draft, never a Step,
 * never a Run.
 *
 * A Journey that is unknown, never published, or unpublished gets the
 * site's own card, so the image reveals nothing a Participant is not shown.
 * Rendered on every request, like the page, so an unpublish shows the
 * moment it happens; the short `Cache-Control` is what keeps a crawler
 * re-reading a shared link from rendering it again.
 */
export const dynamic = "force-dynamic";

export const alt = `A journey on ${APP_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function JourneyOpenGraphImage({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}) {
  const { journeyId } = await params;
  const journey = await getPublicJourney(journeyId);

  return ogResponse(
    journey?.kind === "live" ? (
      <LinkPreviewCard
        kicker={journey.projectTitle}
        title={journey.title}
        description={journey.description}
        palette={linkPreviewPalette(journey.theme)}
      />
    ) : (
      <BrandCard />
    ),
    { cacheControl: OG_CACHE_CONTROL },
  );
}
