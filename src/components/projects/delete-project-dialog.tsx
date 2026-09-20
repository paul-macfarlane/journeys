"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteProjectAction } from "@/app/projects/actions";
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
 * Deleting a Project is a hard delete and takes its journeys with it, so it
 * only ever happens behind an explicit confirmation.
 */
export function DeleteProjectDialog({
  title,
  slug,
}: {
  title: string;
  slug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setServerError(null);
    startTransition(async () => {
      const result = await deleteProjectAction(slug);

      if (!result.ok) {
        setServerError(result.error);
        return;
      }

      setOpen(false);
      router.push("/projects");
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
        Delete project
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the project and every journey in it, for every member.
            It cannot be undone.
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
