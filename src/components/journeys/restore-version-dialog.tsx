"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { restoreVersionAction } from "@/app/projects/[projectId]/journeys/actions";
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
 * Restoring replaces the Draft an Author has been working on, so it only
 * ever happens behind an explicit confirmation. The Published Version itself
 * is untouched, and so is whatever participants are walking.
 */
export function RestoreVersionDialog({
  projectId,
  journeyId,
  versionId,
  versionNumber,
}: {
  projectId: string;
  journeyId: string;
  versionId: string;
  versionNumber: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmRestore() {
    setServerError(null);
    startTransition(async () => {
      const result = await restoreVersionAction(
        projectId,
        journeyId,
        versionId,
      );

      if (!result.ok) {
        setServerError(result.error);
        return;
      }

      setOpen(false);
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
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        Restore
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Replace the draft with version {versionNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The draft’s steps, choices, and outcomes are replaced by this
            version’s. Published versions are unchanged, and participants keep
            reading the live one until you publish again.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={confirmRestore}>
            Restore version
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
