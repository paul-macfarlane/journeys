"use client";

import { useState, useTransition } from "react";

import { deleteAccountAction } from "@/app/projects/(list)/settings/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountDeletionPreview } from "@/db/account";

/**
 * Deleting an account is a hard delete of every Project the Author is the
 * only Member of, and only ever happens behind this confirmation: what will
 * be deleted, what stays, and the Author's own email typed back. On success
 * `deleteAccountAction` redirects (ticket 77), so this dialog only ever
 * renders a result on a refusal.
 */
export function DeleteAccountDialog({
  preview,
  email,
}: {
  preview: AccountDeletionPreview;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmed = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  function confirmDelete() {
    setServerError(null);
    startTransition(async () => {
      const result = await deleteAccountAction({ email: confirmEmail });
      if (!result.ok) {
        setServerError(result.error);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setServerError(null);
          setConfirmEmail("");
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Delete account
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2 text-left text-sm">
          {preview.deleted.length > 0 ? (
            <div>
              <p>These projects will be deleted, with everything in them:</p>
              <ul
                aria-label="Projects that will be deleted"
                className="list-disc pl-5"
              >
                {preview.deleted.map((deletedProject) => (
                  <li key={deletedProject.id}>{deletedProject.title}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No projects will be deleted.</p>
          )}
          <p>
            Projects you share with other members stay with them
            {preview.shared.length > 0
              ? `: ${preview.shared.map((sharedProject) => sharedProject.title).join(", ")}.`
              : "."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-account-confirm-email">
            Type your email to confirm
          </Label>
          <Input
            id="delete-account-confirm-email"
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
          />
        </div>

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || !confirmed}
            onClick={confirmDelete}
          >
            Delete account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
