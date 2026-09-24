import { useState } from "react";

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
import { choiceLabel } from "@/components/journeys/editor-shared";
import { Button } from "@/components/ui/button";
import type { GraphDocument, Step } from "@/lib/graph/document";
import { choicesTargeting } from "@/lib/graph/edit";

/**
 * The confirmation for deleting a Step, shared by every place an Author asks
 * for one: the panel's own button, the toolbar on the Step's box, and Delete
 * or Backspace pressed on the box itself. One component so the question, the
 * list, and the wording are the same move wherever it is started from. Never
 * offered for the Start: a Step that cannot be deleted is not offered a
 * delete, and `removeStep` in `src/lib/graph/edit.ts` refusing it is the last
 * line of defence, not the first thing the Author sees.
 */

/**
 * The confirmation itself, inside whichever `AlertDialog` opens it: the
 * panel's below, which has a trigger of its own, or the canvas's, which has
 * none — a key or a toolbar button opens it, and one instance serves every
 * box. Named by `stepId` rather than handed the Step, because the Step is
 * already gone while the dialog is closing after a confirm, and the Choices
 * left pointing at it are still what it names.
 *
 * Deleting a Step leaves every Choice aimed at it dangling rather than
 * silently rewriting another Step's Choices, so the confirmation names each
 * one the Author is about to break.
 */
export function DeleteStepConfirmation({
  document,
  stepId,
  onDeleteStep,
  onClose,
}: {
  document: GraphDocument;
  stepId: string;
  onDeleteStep: (stepId: string) => void;
  /** Confirming closes the dialog itself; cancelling is the dialog's own. */
  onClose: () => void;
}) {
  const affected = choicesTargeting(document, stepId);

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this step?</AlertDialogTitle>
        <AlertDialogDescription>
          {affected.length > 0
            ? "These choices will point at a step that no longer exists:"
            : "No choices point at this step."}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {affected.length > 0 ? (
        // role="list" is explicit for consistency with the app's other
        // lists, and so the labelled list is announced inside the dialog.
        <ul
          role="list"
          aria-label="Affected choices"
          className="flex list-disc flex-col gap-1 pl-5 text-sm"
        >
          {affected.map((entry) => (
            <li key={entry.choice.id}>
              {`${choiceLabel(entry.choice.label)} on ${entry.stepTitle}`}
            </li>
          ))}
        </ul>
      ) : null}

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => {
            onClose();
            onDeleteStep(stepId);
          }}
        >
          Delete step
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

/** The confirmation with its own button to open it: the panel's foot. */
export function DeleteStepDialog({
  document,
  step,
  onDeleteStep,
}: {
  document: GraphDocument;
  step: Step;
  onDeleteStep: (stepId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
          Delete step
        </AlertDialogTrigger>
        <DeleteStepConfirmation
          document={document}
          stepId={step.id}
          onDeleteStep={onDeleteStep}
          onClose={() => setOpen(false)}
        />
      </AlertDialog>
    </div>
  );
}
