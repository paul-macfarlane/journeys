"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteJourneyAction } from "@/app/projects/[projectId]/journeys/actions";
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

/**
 * Deleting a Journey is a hard delete, so it only ever happens behind an
 * explicit confirmation.
 */
export function DeleteJourneyDialog({
  projectId,
  journeyId,
  title,
}: {
  projectId: string;
  journeyId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setServerError(null);
    startTransition(async () => {
      const result = await deleteJourneyAction(projectId, journeyId);

      if (!result.ok) {
        setServerError(result.error);
        return;
      }

      setOpen(false);
      router.push(`/projects/${projectId}`);
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setServerError(null);
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Delete journey
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the journey for every member of the project. It cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={confirmDelete}
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
