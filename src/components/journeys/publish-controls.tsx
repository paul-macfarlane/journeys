"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  publishJourneyAction,
  unpublishJourneyAction,
} from "@/app/projects/[projectId]/journeys/actions";
import { CopyLinkButton } from "@/components/journeys/copy-link-button";
import {
  DraftVersionScope,
  useSettledDraftVersion,
} from "@/components/journeys/draft-version";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { PublishProblem } from "@/lib/graph/validate";

/**
 * Publishing a Journey and taking it back.
 *
 * Publishing is not destructive — it snapshots the Draft as the next
 * Published Version — so it happens on one click from the page header, and
 * a Draft that isn't ready comes back with everything wrong with it in a
 * dialog rather than a version. Unpublishing takes a journey away from
 * participants, so it asks first.
 *
 * A publish that went through is acknowledged in one line beside the
 * header's controls (ticket 65): which Published Version it made, that
 * Participants see it now, and the participant link. The Journey page has
 * two Publish buttons — the header's and, while there is something to
 * publish, the Versions tab's Draft row's — and the row goes the moment its
 * publish lands, so the acknowledgement lives above both of them in
 * `PublishScope` and is shown by `PublishAcknowledgement`, in the header,
 * whichever button made it.
 *
 * A restore that went through (ticket 79 item 4) is acknowledged the same
 * way, from `RestoreVersionDialog` through `useAcknowledgeRestore`: one line
 * naming the version restored into the Draft, shown even when that version
 * turns out to hold exactly what the Draft already did. Either line stays
 * until a later change to the Draft; see `PublishScope` for how "later" is
 * told.
 */

type Refusal = { error: string; problems: PublishProblem[] };

/**
 * What a successful publish or restore leaves behind to be acknowledged,
 * with the Draft version its own action left: a publish's is the version it
 * was guarded by (after the editor's flush), a restore's the one its write
 * made.
 */
type Acknowledgement =
  | { kind: "published"; versionNumber: number; draftVersion: number }
  | { kind: "restored"; versionNumber: number; draftVersion: number };

/**
 * The acknowledgement held, and — for a publish — whether the page has
 * rendered it yet with nothing left to publish: the moment the line first
 * says something true.
 */
type Held = { acknowledgement: Acknowledgement; shown: boolean };

type PublishScopeValue = {
  acknowledgement: Acknowledgement | null;
  acknowledge: (acknowledgement: Acknowledgement) => void;
};

const PublishScopeContext = createContext<PublishScopeValue | null>(null);

function usePublishScope(caller: string): PublishScopeValue {
  const scope = useContext(PublishScopeContext);
  if (scope === null) {
    throw new Error(`${caller} must be rendered inside PublishScope`);
  }
  return scope;
}

/**
 * Holds the acknowledgement of the last publish or restore for everything
 * beneath it, and the Draft version the Member holds (`DraftVersionScope`).
 *
 * The line stays until something after the acknowledged action changes the
 * Draft, or the page is left, which unmounts this. "After" is read from
 * values, never from the order renders arrive in: the action's response and
 * the page's re-render can land either way round, and a publish's click can
 * also blur an open editor whose save of a just-typed edit lands in the
 * same breath. So each acknowledgement records the Draft version its own
 * action left, and is cleared by:
 *
 * - a page `draftVersion` past that version — an edit, of either kind of
 *   acknowledgement, made after it; the action's own settling can only
 *   bring the page up to the recorded version, never past it;
 * - for a publish only, `hasUnpublishedChanges` true once the line has been
 *   shown — rendered with nothing left to publish, which only the publish's
 *   own re-render can do. A title or description edit, or an unpublish,
 *   turns the flag on without moving the Draft version; a flag still on
 *   from before the publish settled (the blurred editor's save) comes
 *   before the line was shown, so it cannot clear it.
 *
 * A restore has no second rule: restoring an earlier version can leave the
 * Draft matching what is live or not, either way acknowledged, so the flag
 * says nothing about it. Adjusted during render, the way React suggests for
 * state that follows a prop, rather than in an effect.
 */
export function PublishScope({
  hasUnpublishedChanges,
  draftVersion,
  children,
}: {
  /** The header's own: false only while the live version matches the Draft. */
  hasUnpublishedChanges: boolean;
  /** The Draft version the page read. */
  draftVersion: number;
  children: ReactNode;
}) {
  const [held, setHeld] = useState<Held | null>(null);

  if (held !== null) {
    const { acknowledgement, shown } = held;
    const published = acknowledgement.kind === "published";
    if (
      draftVersion > acknowledgement.draftVersion ||
      (published && shown && hasUnpublishedChanges)
    ) {
      setHeld(null);
    } else if (published && !shown && !hasUnpublishedChanges) {
      setHeld({ acknowledgement, shown: true });
    }
  }

  function acknowledge(next: Acknowledgement) {
    setHeld({ acknowledgement: next, shown: false });
  }

  const acknowledgement = held?.acknowledgement ?? null;

  return (
    <PublishScopeContext.Provider
      value={{
        // A publish's line is hidden while there is something to publish —
        // before its own re-render has landed, or after a later change the
        // rules above have not yet seen — because it says participants see
        // this Draft, which is not true then. A restore's line says nothing
        // about that, so only the rules above take it away.
        acknowledgement:
          acknowledgement?.kind === "published" && hasUnpublishedChanges
            ? null
            : acknowledgement,
        acknowledge,
      }}
    >
      <DraftVersionScope draftVersion={draftVersion}>
        {children}
      </DraftVersionScope>
    </PublishScopeContext.Provider>
  );
}

/**
 * The line that says a publish or a restore went through, in the header
 * beside the controls: "Published Version N — participants see it now." with
 * the participant link to copy, or "Restored Version N into the Draft." for
 * a restore, which has no participant link because nothing was published.
 * One `role="status"` so a screen reader hears it without being moved;
 * nothing until there is something to say. The copy control's own "Copied"
 * is a live region inside this one, so a copy may be read back as the whole
 * line: brief, and the line is short.
 */
export function PublishAcknowledgement({ journeyId }: { journeyId: string }) {
  const { acknowledgement } = usePublishScope("PublishAcknowledgement");
  if (acknowledgement === null) return null;

  return (
    <p
      role="status"
      className="flex basis-full flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm"
    >
      <span>
        {acknowledgement.kind === "published"
          ? `Published Version ${acknowledgement.versionNumber} — participants see it now.`
          : `Restored Version ${acknowledgement.versionNumber} into the Draft.`}
      </span>
      {acknowledgement.kind === "published" ? (
        <CopyLinkButton path={`/j/${journeyId}`} />
      ) : null}
    </p>
  );
}

/**
 * What `RestoreVersionDialog` calls once a restore lands, to acknowledge it
 * the way `PublishButton` acknowledges a publish: through the same
 * `PublishScope` this must be rendered inside.
 */
export function useAcknowledgeRestore(): (
  versionNumber: number,
  draftVersion: number,
) => void {
  const { acknowledge } = usePublishScope("useAcknowledgeRestore");
  return (versionNumber: number, draftVersion: number) =>
    acknowledge({ kind: "restored", versionNumber, draftVersion });
}

export function PublishButton({
  projectId,
  journeyId,
  hasUnpublishedChanges,
  size = "default",
}: {
  projectId: string;
  journeyId: string;
  /**
   * False only while the live version matches what is here: the Draft's
   * document and the Journey's title and description.
   */
  hasUnpublishedChanges: boolean;
  /** `sm` beside the Versions tab's row actions; the page header's is full size. */
  size?: "default" | "sm";
}) {
  const { acknowledge } = usePublishScope("PublishButton");
  const settledDraftVersion = useSettledDraftVersion();
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  function publish() {
    startTransition(async () => {
      // Clicking this blurred the editor, whose save of the last edit is on
      // its way: the publish is sent with the version that save leaves.
      const draftVersion = await settledDraftVersion();
      const result = await publishJourneyAction(
        projectId,
        journeyId,
        draftVersion,
      );

      if (!result.ok) {
        setRefusal({ error: result.error, problems: result.problems ?? [] });
        return;
      }
      // Published: the header's line says which version. Acknowledged here
      // rather than kept here because the Versions tab's button is gone by
      // the time its own publish has landed.
      acknowledge({
        kind: "published",
        versionNumber: result.versionNumber,
        draftVersion: result.draftVersion,
      });
      // No router.refresh(): the action revalidates the Journey page, so its
      // response already carries the re-rendered tree. A second refresh
      // landed hundreds of milliseconds later under load and re-rendered
      // the Versions list beneath whatever the Author had just opened.
    });
  }

  const problems = refusal?.problems ?? [];

  return (
    <>
      {/* Nothing to publish while participants already see this Draft. */}
      <Button
        size={size}
        disabled={pending || !hasUnpublishedChanges}
        onClick={publish}
      >
        Publish
      </Button>

      <AlertDialog
        open={refusal !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRefusal(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{refusal?.error}</AlertDialogTitle>
            <AlertDialogDescription>
              {problems.length > 0
                ? "Nothing was published. Fix these on the map, then publish again."
                : "Nothing was published."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {problems.length > 0 ? (
            // role="list" is explicit for consistency with the app's other
            // lists. One rule can name the same Step more than once (one
            // entry per dangling Choice), so the Choice id is part of the key.
            <ul
              role="list"
              aria-label="Publishing problems"
              className="flex list-disc flex-col gap-1 pl-5 text-sm text-destructive"
            >
              {problems.map((problem, index) => (
                <li
                  key={`${problem.code}-${problem.stepId ?? ""}-${problem.choiceId ?? index}`}
                >
                  {problem.message}
                </li>
              ))}
            </ul>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function UnpublishButton({
  projectId,
  journeyId,
}: {
  projectId: string;
  journeyId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirmUnpublish() {
    setError(null);
    startTransition(async () => {
      const result = await unpublishJourneyAction(projectId, journeyId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // The action revalidates the page; see PublishButton.
      setOpen(false);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        Unpublish
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unpublish this journey?</AlertDialogTitle>
          <AlertDialogDescription>
            Participants can no longer walk it. Every published version is kept,
            so publishing again picks up where this left off.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={confirmUnpublish}>
            Unpublish journey
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
