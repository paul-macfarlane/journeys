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
 * The confirmation for deleting a Step, shared by the two places an Author
 * asks for one: the panel's own button and the toolbar on the Step's box.
 * One component so the question, the list, and the wording are the same move
 * wherever it is started from. Never rendered for the Start: a Step that
 * cannot be deleted is not offered a delete, and `removeStep` in
 * `src/lib/graph/edit.ts` refusing it is the last line of defence, not the
 * first thing the Author sees.
 */

/**
 * Deleting a Step leaves every Choice aimed at it dangling rather than
 * silently rewriting another Step's Choices, so the confirmation names each
 * one the Author is about to break.
 */
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
  const affected = choicesTargeting(document, step.id);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
          Delete step
        </AlertDialogTrigger>
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
                setOpen(false);
                onDeleteStep(step.id);
              }}
            >
              Delete step
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
