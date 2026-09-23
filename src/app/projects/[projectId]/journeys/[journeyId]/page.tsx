import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AnalyticsTab,
  type SelectedVersionAnalytics,
} from "@/components/journeys/analytics-tab";
import { CopyLinkButton } from "@/components/journeys/copy-link-button";
import { DeleteJourneyDialog } from "@/components/journeys/delete-journey-dialog";
import { DraftEditor } from "@/components/journeys/draft-editor";
import { JourneyStatusBadge } from "@/components/journeys/journey-status-badge";
import { JourneyThemeSettings } from "@/components/journeys/journey-theme-settings";
import { JourneyTitleFields } from "@/components/journeys/journey-title-fields";
import {
  PublishButton,
  UnpublishButton,
} from "@/components/journeys/publish-controls";
import { ResponseList } from "@/components/journeys/response-list";
import { VersionList } from "@/components/journeys/version-list";
import { buttonVariants } from "@/components/ui/button";
import { UrlTabs } from "@/components/url-tabs";
import { getAnalyticsForMember } from "@/db/analytics";
import { getDraftForMember } from "@/db/drafts";
import { getJourneyForMember } from "@/db/journeys";
import { getProjectForMember } from "@/db/projects";
import { listResponsesForMember } from "@/db/responses";
import { getLiveVersion, listVersionsForMember } from "@/db/versions";
import { analyticsForVersion, chooseVersionId } from "@/lib/analytics";
import { documentsEqual } from "@/lib/graph/document";
import { groupResponsesByStep } from "@/lib/response-list";
import { requireSession } from "@/lib/session";
import { readTab } from "@/lib/tabs";
import { cn } from "@/lib/utils";

/** The page's sections, the first being what the plain address opens on. */
const JOURNEY_TABS = [
  "editor",
  "versions",
  "analytics",
  "responses",
  "settings",
] as const;

export default async function JourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; journeyId: string }>;
  searchParams: Promise<{
    tab?: string | string[];
    /** The Published Version the Analytics tab reads; see `chooseVersionId`. */
    version?: string | string[];
  }>;
}) {
  const session = await requireSession();
  const [{ projectId, journeyId }, { tab, version }] = await Promise.all([
    params,
    searchParams,
  ]);

  // Null for a non-Member, an unknown Project, and an unknown Journey
  // alike, so all three get the same 404.
  const journey = await getJourneyForMember(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!journey) notFound();

  // The Project, for the Theme the Journey inherits on its Settings tab —
  // the request-cached read the layout already made for the navbar.
  const project = await getProjectForMember(projectId, session.user.id);
  if (!project) notFound();

  // Every Journey has a Draft, created with it — a missing one is a Journey
  // that cannot be authored, so it gets the same 404 rather than a page with
  // a hole in it.
  const draft = await getDraftForMember(projectId, journeyId, session.user.id);
  if (!draft) notFound();

  // Null only for a non-Member, which the check above already answered; an
  // empty list is a Journey that has never been published.
  const versions = await listVersionsForMember(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!versions) notFound();

  // Null only for a non-Member, already answered above; the rows are every
  // Response any version of this Journey has recorded, arranged per Step.
  const responses = await listResponsesForMember(
    projectId,
    journeyId,
    session.user.id,
  );
  if (!responses) notFound();
  const responseGroups = groupResponsesByStep(draft, responses);

  // The Analytics tab reads one Published Version: the one the address
  // names when it is this Journey's, else the live one, else the newest.
  // Null only for a Journey never published; `getAnalyticsForMember` can
  // otherwise only refuse a non-Member, already answered above.
  const analyticsVersionId = chooseVersionId(versions, version);
  const analyticsSource =
    analyticsVersionId === null
      ? null
      : await getAnalyticsForMember(
          projectId,
          journeyId,
          analyticsVersionId,
          session.user.id,
        );
  const selectedAnalytics: SelectedVersionAnalytics | null = analyticsSource
    ? {
        versionId: analyticsSource.version.id,
        document: analyticsSource.version.document,
        analytics: analyticsForVersion(
          analyticsSource.version.id,
          analyticsSource.version.document,
          analyticsSource.runs,
        ),
      }
    : null;

  // Publish has nothing to do while participants already see exactly this:
  // the Draft, the title, and the description. An unpublished or
  // never-published Journey always has something to publish.
  const live = await getLiveVersion(projectId, journeyId, session.user.id);
  const hasUnpublishedChanges =
    live === null ||
    live.title !== journey.title ||
    live.description !== journey.description ||
    !documentsEqual(draft, live.document);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="text-muted-foreground text-sm hover:text-foreground"
        >
          ← Back to project
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-96 flex-col gap-2">
          <JourneyTitleFields
            projectId={projectId}
            journeyId={journey.id}
            title={journey.title}
            description={journey.description}
          />

          <div className="flex flex-wrap items-center gap-2">
            <JourneyStatusBadge publishState={journey.publishState} />
            {/* Only a live Journey has an address to hand out, or changes
                participants are not yet seeing, or anything to take back. */}
            {live !== null ? (
              <>
                {hasUnpublishedChanges ? (
                  <span className="text-muted-foreground text-xs">
                    Unpublished changes
                  </span>
                ) : null}
                <CopyLinkButton path={`/j/${journey.id}`} />
                <UnpublishButton projectId={projectId} journeyId={journey.id} />
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/journeys/${journey.id}/preview`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Preview
          </Link>
          <PublishButton
            projectId={projectId}
            journeyId={journey.id}
            hasUnpublishedChanges={hasUnpublishedChanges}
          />
          <DeleteJourneyDialog
            projectId={projectId}
            journeyId={journey.id}
            title={journey.title}
          />
        </div>
      </header>

      <UrlTabs
        label="Journey"
        initialTab={readTab(JOURNEY_TABS, tab)}
        tabs={[
          {
            value: "editor",
            label: "Editor",
            content: (
              <DraftEditor
                projectId={projectId}
                journeyId={journey.id}
                draft={draft}
              />
            ),
          },
          {
            value: "versions",
            label: "Versions",
            content: (
              <VersionList
                projectId={projectId}
                journeyId={journey.id}
                versions={versions}
              />
            ),
          },
          {
            value: "analytics",
            label: "Analytics",
            content: (
              <AnalyticsTab versions={versions} selected={selectedAnalytics} />
            ),
          },
          {
            value: "responses",
            label: "Responses",
            content: <ResponseList groups={responseGroups} />,
          },
          {
            value: "settings",
            label: "Settings",
            content: (
              <section aria-label="Settings" className="flex flex-col gap-8">
                <JourneyThemeSettings
                  projectId={projectId}
                  journeyId={journey.id}
                  projectTheme={project.theme}
                  theme={journey.theme}
                />
              </section>
            ),
          },
        ]}
      />
    </main>
  );
}
