"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { restoreVersionAction } from "@/app/projects/[projectId]/journeys/actions";
import { useSettledDraftVersion } from "@/components/journeys/draft-version";
import { StaleNotice } from "@/components/stale-notice";
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
 *
 * The restore is sent with the Draft version the Member holds (ticket 73):
 * a Draft another Member saved since is not replaced, and the dialog says
 * so with a Reload instead.
 */
export function RestoreVersionDialog({
  projectId,
  journeyId,
  versionId,
  versionNumber,
  triggerLabel = "Restore",
  triggerVariant = "outline",
}: {
  projectId: string;
  journeyId: string;
  versionId: string;
  versionNumber: number;
  /** What the button that opens it says; "Restore" on the Versions tab. */
  triggerLabel?: string;
  triggerVariant?: "outline" | "default";
}) {
  const router = useRouter();
  const settledDraftVersion = useSettledDraftVersion();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmRestore() {
    setServerError(null);
    startTransition(async () => {
      // The editor's unmount save may still be on its way: sent with the
      // version it leaves, not the one the page last rendered.
      const draftVersion = await settledDraftVersion();
      const result = await restoreVersionAction(
        projectId,
        journeyId,
        versionId,
        draftVersion,
      );

      if (!result.ok) {
        if (result.stale) {
          setStale(true);
          return;
        }
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
      <AlertDialogTrigger
        render={<Button variant={triggerVariant} size="sm" />}
      >
        {triggerLabel}
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
        {stale ? <StaleNotice noun="draft" /> : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || stale}
            onClick={confirmRestore}
          >
            Restore version
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
