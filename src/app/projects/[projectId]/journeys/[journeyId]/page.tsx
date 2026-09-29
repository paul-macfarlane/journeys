import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AnalyticsTab,
  type SelectedVersionAnalytics,
} from "@/components/journeys/analytics-tab";
import { CannotBeRead } from "@/components/cannot-be-read";
import { CopyLinkButton } from "@/components/journeys/copy-link-button";
import { DeleteJourneyDialog } from "@/components/journeys/delete-journey-dialog";
import { DraftEditor } from "@/components/journeys/draft-editor";
import { JourneyStatusBadge } from "@/components/journeys/journey-status-badge";
import { JourneyThemeSettings } from "@/components/journeys/journey-theme-settings";
import { JourneyTitleFields } from "@/components/journeys/journey-title-fields";
import {
  PublishAcknowledgement,
  PublishButton,
  PublishScope,
  UnpublishButton,
} from "@/components/journeys/publish-controls";
import { ResponseList } from "@/components/journeys/response-list";
import { RestoreVersionDialog } from "@/components/journeys/restore-version-dialog";
import { VersionList } from "@/components/journeys/version-list";
import { buttonVariants } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { UrlTabs } from "@/components/url-tabs";
import { journeyForMember } from "@/db/access";
import { getAnalytics } from "@/db/analytics";
import { getDraft } from "@/db/drafts";
import { listResponses } from "@/db/responses";
import { getLiveVersion, listVersions } from "@/db/versions";
import { analyticsForVersion, chooseVersionId } from "@/lib/analytics";
import { draftPending } from "@/lib/publish-state";
import { groupResponsesByStep } from "@/lib/response-list";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * The tab title (ticket 78): the Journey's title, with the root layout's
 * template appending "· Journeys". `requireSession` and `journeyForMember`
 * are `cache()`d, so the page below pays no second query. A non-Member, an
 * unknown Project, and an unknown Journey all take the same 404 as the page
 * itself (ticket 60): metadata streams in after the page, so a title
 * returned for a missing Journey would replace the not-found page's own.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string; journeyId: string }>;
}): Promise<Metadata> {
  const session = await requireSession();
  const { projectId, journeyId } = await params;
  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) notFound();
  return { title: journey.title };
}

export default async function JourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; journeyId: string }>;
  searchParams: Promise<{
    // The open tab is `?tab=<name>` too, read by `UrlTabs` itself.
    /** The Published Version the Analytics tab reads; see `chooseVersionId`. */
    version?: string | string[];
  }>;
}) {
  const session = await requireSession();
  const [{ projectId, journeyId }, { version }] = await Promise.all([
    params,
    searchParams,
  ]);

  // Membership, resolved once for the whole render (ticket 82): null for a
  // non-Member, an unknown Project, and an unknown Journey alike, so all
  // three get the same 404. Every read below takes this `MemberJourney`,
  // and its Project — for the Theme the Journey inherits on its Settings
  // tab — came back in the same query.
  const journey = await journeyForMember(projectId, journeyId, session.user.id);
  if (!journey) notFound();

  // Every Journey has a Draft, created with it — a missing one is a Journey
  // that cannot be authored, so it gets the same 404 rather than a page with
  // a hole in it.
  const stored = await getDraft(journey);
  if (!stored) notFound();
  // A Draft row that fails the document contract is not a 500 (ticket 73):
  // the page keeps its header and tabs, and the Editor tab says the Draft
  // cannot be read and offers a Restore in place of the editor.
  const draft = stored.kind === "ok" ? stored.document : null;

  // An empty list is a Journey that has never been published.
  const versions = await listVersions(journey);

  // Every Response any version of this Journey has recorded, arranged per
  // Step below.
  const responses = await listResponses(journey);

  // The Analytics tab reads one Published Version: the one the address
  // names when it is this Journey's, else the live one, else the newest.
  // Null only for a Journey never published.
  const analyticsVersionId = chooseVersionId(versions, version);
  const analyticsSource =
    analyticsVersionId === null
      ? null
      : await getAnalytics(journey, analyticsVersionId);
  const selectedAnalytics: SelectedVersionAnalytics | null =
    analyticsSource?.kind === "ok"
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
  // The selected Published Version's row fails the document contract
  // (ticket 83): the Analytics tab names it in a banner instead of the
  // map and chart.
  const unreadableAnalyticsVersion =
    analyticsSource?.kind === "unreadable"
      ? {
          versionId: analyticsSource.versionId,
          versionNumber: analyticsSource.versionNumber,
        }
      : null;

  // Publish has nothing to do while participants already see exactly this:
  // the Draft, the title, and the description. An unpublished or
  // never-published Journey always has something to publish, and so does
  // one whose Draft or live version cannot be read (see `draftPending`).
  // `draftEditedAt` is when the Draft was last edited, for its row on the
  // Versions tab.
  const live = await getLiveVersion(journey);
  const liveOk = live?.kind === "ok" ? live : null;
  const { hasUnpublishedChanges, draftEditedAt } = draftPending({
    journey,
    draft: { document: draft, updatedAt: stored.updatedAt },
    live,
  });
  // Named on the Versions tab, above the list, while the Journey's live
  // pointer names a Published Version that cannot be read.
  const unreadableLiveVersion =
    live?.kind === "unreadable" ? { versionNumber: live.versionNumber } : null;

  // Responses are arranged by the Draft's Steps, or — with a Draft that
  // cannot be read — by the live version's, else not at all.
  const responseDocument = draft ?? liveOk?.document ?? null;
  const responseGroups =
    responseDocument === null
      ? []
      : groupResponsesByStep(responseDocument, responses);

  return (
    <>
      {/* Holds the acknowledgement of a publish for both Publish buttons;
          see PublishScope for why it is not the header button's own. */}
      <PublishScope
        hasUnpublishedChanges={hasUnpublishedChanges}
        draftVersion={stored.version}
      >
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
            {/* The visible title is `JourneyTitleFields`' input
                (`aria-label="Title"`), not a heading, so the page carries no
                `h1` of its own without this: an `sr-only` one names the
                Journey for a screen reader and for axe's
                `page-has-heading-one` (ticket 78), with every heading below
                it on each tab descending one level at a time from it. */}
            <h1 className="sr-only">{journey.title}</h1>
            <div className="flex min-w-0 flex-1 basis-96 flex-col gap-2">
              <JourneyTitleFields
                projectId={projectId}
                journeyId={journey.id}
                title={journey.title}
                description={journey.description}
              />

              <div className="flex flex-wrap items-center gap-2">
                <JourneyStatusBadge
                  publishState={journey.publishState}
                  entrance
                />
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
                    <UnpublishButton
                      projectId={projectId}
                      journeyId={journey.id}
                    />
                  </>
                ) : null}
              </div>
            </div>

            {/* Wraps so the acknowledgement of a publish takes the line
              beneath the controls, flush with them, rather than squeezing
              in beside them. */}
            <div className="flex flex-wrap items-center justify-end gap-2">
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
              <PublishAcknowledgement journeyId={journey.id} />
            </div>
          </header>

          <UrlTabs
            label="Journey"
            sticky
            tabs={[
              {
                value: "editor",
                label: "Editor",
                content:
                  draft !== null ? (
                    <DraftEditor
                      projectId={projectId}
                      journeyId={journey.id}
                      draft={draft}
                      version={stored.version}
                    />
                  ) : (
                    <UnreadableDraft
                      projectId={projectId}
                      journeyId={journey.id}
                      title={journey.title}
                      newest={versions[0] ?? null}
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
                    hasUnpublishedChanges={hasUnpublishedChanges}
                    draftUpdatedAt={draftEditedAt}
                    unreadableLive={unreadableLiveVersion}
                  />
                ),
              },
              {
                value: "analytics",
                label: "Analytics",
                content: (
                  <AnalyticsTab
                    versions={versions}
                    selected={selectedAnalytics}
                    unreadable={unreadableAnalyticsVersion}
                  />
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
                  <section
                    aria-label="Settings"
                    className="flex flex-col gap-8"
                  >
                    <JourneyThemeSettings
                      projectId={projectId}
                      journeyId={journey.id}
                      projectTheme={journey.project.theme}
                      theme={journey.theme}
                    />
                  </section>
                ),
              },
            ]}
          />
        </main>
      </PublishScope>
      <SiteFooter />
    </>
  );
}

/**
 * The Editor tab when the Draft's row fails the document contract (ticket
 * 73): which Journey, what happened, and — when the Journey has been
 * published — the newest Published Version to restore it from.
 */
function UnreadableDraft({
  projectId,
  journeyId,
  title,
  newest,
}: {
  projectId: string;
  journeyId: string;
  title: string;
  newest: { id: string; versionNumber: number } | null;
}) {
  return (
    <CannotBeRead
      title="This draft can't be read"
      action={
        newest !== null ? (
          <RestoreVersionDialog
            projectId={projectId}
            journeyId={journeyId}
            versionId={newest.id}
            versionNumber={newest.versionNumber}
            triggerLabel={`Restore from Version ${newest.versionNumber}`}
            triggerVariant="default"
          />
        ) : undefined
      }
    >
      <p>
        The draft of “{title}” is stored in a shape the editor can&apos;t read,
        so it can&apos;t be edited, previewed, or published.
      </p>
      <p className="mt-2">
        {newest !== null
          ? `Restoring Version ${newest.versionNumber} replaces the draft with that version's steps, choices, and outcomes.`
          : "No published version exists to restore it from."}
      </p>
    </CannotBeRead>
  );
}
