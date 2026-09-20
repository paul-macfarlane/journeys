"use client";

import { useRouter } from "next/navigation";
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
import type { PublishState } from "@/lib/publish-state";

/**
 * Publishing a Journey and taking it back.
 *
 * Publishing is not destructive — it snapshots the Draft as the next
 * Published Version — so it happens on one click, and a Draft that isn't
 * ready comes back with everything wrong with it rather than a dialog.
 * Unpublishing takes a journey away from participants, so it asks first.
 */
export function PublishControls({
  projectId,
  journeyId,
  publishState,
}: {
  projectId: string;
  journeyId: string;
  publishState: PublishState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<PublishProblem[]>([]);
  const [unpublishOpen, setUnpublishOpen] = useState(false);

  function clearRefusal() {
    setError(null);
    setProblems([]);
  }

  function publish() {
    clearRefusal();
    startTransition(async () => {
      const result = await publishJourneyAction(projectId, journeyId);

      if (!result.ok) {
        setError(result.error);
        setProblems(result.problems ?? []);
        return;
      }

      router.refresh();
    });
  }

  function confirmUnpublish() {
    clearRefusal();
    startTransition(async () => {
      const result = await unpublishJourneyAction(projectId, journeyId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUnpublishOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} onClick={publish}>
          Publish
        </Button>

        {publishState === "published" ? (
          <AlertDialog
            open={unpublishOpen}
            onOpenChange={(nextOpen) => {
              setUnpublishOpen(nextOpen);
              if (!nextOpen) clearRefusal();
            }}
          >
            <AlertDialogTrigger render={<Button variant="outline" />}>
              Unpublish
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unpublish this journey?</AlertDialogTitle>
                <AlertDialogDescription>
                  Participants can no longer walk it. Every published version is
                  kept, so publishing again picks up where this left off.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending}
                  onClick={confirmUnpublish}
                >
                  Unpublish journey
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        <p className="text-muted-foreground text-sm">
          Publishing snapshots the draft as it stands now.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-xl px-4 py-3 ring-1 ring-destructive/40"
        >
          <p className="text-sm text-destructive">{error}</p>
          {problems.length > 0 ? (
            // role="list" is explicit: the list marker survives here, but the
            // app's other lists say so and this one is read out as evidence.
            <ul
              role="list"
              aria-label="Publishing problems"
              className="flex list-disc flex-col gap-1 pl-5 text-sm text-destructive"
            >
              {problems.map((problem, index) => (
                <li key={`${problem.code}-${problem.stepId ?? index}`}>
                  {problem.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
