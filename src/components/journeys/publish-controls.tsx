"use client";

import { useState, useTransition } from "react";

import {
  publishJourneyAction,
  unpublishJourneyAction,
} from "@/app/projects/[projectId]/journeys/actions";
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
 */

type Refusal = { error: string; problems: PublishProblem[] };

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
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  function publish() {
    startTransition(async () => {
      const result = await publishJourneyAction(projectId, journeyId);

      if (!result.ok) {
        setRefusal({ error: result.error, problems: result.problems ?? [] });
        return;
      }
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
