import { useState } from "react";

import { ChoiceList } from "@/components/journeys/choice-list";
import {
  SELECT_CLASS,
  type SelectStep,
} from "@/components/journeys/editor-shared";
import { RichTextEditor } from "@/components/journeys/rich-text-editor";
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
import type { Content } from "@/lib/graph/content";
import { isEnding, type GraphDocument, type Step } from "@/lib/graph/document";
import { choicesTargeting, setStart, updateStep } from "@/lib/graph/edit";
import { cn } from "@/lib/utils";

/**
 * One Step, opened for editing: its title, where a participant comes to it
 * from, its rich text, its Choices, the Outcome it carries once it is an
 * Ending, and the two moves that change the shape of the Journey around it —
 * making it the Start and deleting it. The title field is the Step's name on
 * this panel; there is no heading repeating it above.
 */

/** A Choice's label as an Author reads it, when it has one. */
function choiceLabel(label: string): string {
  return label.trim().length > 0 ? label : "Untitled choice";
}

/**
 * The Choices on other Steps that lead here, each a button back to its Step:
 * the reverse of "Open" on a Choice row, so an Author can walk the Journey
 * in either direction from the panel.
 */
function LeadsHereFrom({
  document,
  step,
  isStart,
  onSelectStep,
}: {
  document: GraphDocument;
  step: Step;
  isStart: boolean;
  onSelectStep: SelectStep;
}) {
  const incoming = choicesTargeting(document, step.id);

  return (
    <div
      aria-label="Leads here from"
      role="group"
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <span className="text-muted-foreground">Leads here from</span>
      {isStart ? (
        <span className="text-muted-foreground">
          the beginning — participants start here
        </span>
      ) : null}
      {!isStart && incoming.length === 0 ? (
        <span className="text-muted-foreground">
          nothing yet — no choice points at this step
        </span>
      ) : null}
      {incoming.map((entry) => (
        <Button
          key={entry.choice.id}
          variant="outline"
          size="sm"
          onClick={() => onSelectStep(entry.stepId)}
        >
          {`${choiceLabel(entry.choice.label)} on ${entry.stepTitle}`}
        </Button>
      ))}
    </div>
  );
}

/**
 * Deleting a Step leaves every Choice aimed at it dangling rather than
 * silently rewriting another Step's Choices, so the confirmation names each
 * one the Author is about to break.
 */
function DeleteStepDialog({
  document,
  step,
  isStart,
  onDeleteStep,
}: {
  document: GraphDocument;
  step: Step;
  isStart: boolean;
  onDeleteStep: (stepId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const affected = choicesTargeting(document, step.id);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isStart ? (
        <span className="text-muted-foreground text-sm">
          Make another step the start first
        </span>
      ) : null}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" disabled={isStart} />}
        >
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

export function StepPanel({
  document,
  step,
  revision,
  focusTitle,
  onChange,
  onSelectStep,
  onContentChange,
  onContentRefused,
  onDeleteStep,
}: {
  document: GraphDocument;
  step: Step;
  /** Bumped each time the Draft was replaced from outside the editor. */
  revision: number;
  /** True when this Step was just created from a Choice and wants a name. */
  focusTitle: boolean;
  onChange: (document: GraphDocument) => void;
  onSelectStep: SelectStep;
  onContentChange: (stepId: string, content: Content) => void;
  onContentRefused: (error: string) => void;
  onDeleteStep: (stepId: string) => void;
}) {
  const isStart = document.startStepId === step.id;

  return (
    <section
      aria-label="Step"
      className="flex flex-col gap-4 rounded-xl px-4 py-4 ring-1 ring-foreground/10"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="step-title">Step title</Label>
        {/* Keyed by Step so a just-created Step's field mounts fresh and
            `autoFocus` lands on it; the value alone would not refocus. */}
        <Input
          key={step.id}
          id="step-title"
          autoComplete="off"
          autoFocus={focusTitle}
          maxLength={200}
          value={step.title}
          onChange={(event) =>
            onChange(
              updateStep(document, step.id, { title: event.target.value }),
            )
          }
        />
      </div>

      <LeadsHereFrom
        document={document}
        step={step}
        isStart={isStart}
        onSelectStep={onSelectStep}
      />

      <RichTextEditor
        resetKey={`${step.id}:${revision}`}
        content={step.content}
        onChange={(content) => onContentChange(step.id, content)}
        onRefused={onContentRefused}
      />

      {/* Keyed by Step: the half-typed Choice and the open confirmation
          belong to the Step they were started on, not to the next one. The
          two keys are prefixed because they are siblings. */}
      <ChoiceList
        key={`choices-${step.id}`}
        document={document}
        step={step}
        onChange={onChange}
        onSelectStep={onSelectStep}
      />

      {/* Only an Ending carries an Outcome; a Step a participant can walk on
          from has nothing to be grouped by yet. */}
      {isEnding(step) ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="step-outcome">Outcome</Label>
          <select
            id="step-outcome"
            aria-label="Outcome"
            className={cn(SELECT_CLASS, "w-64")}
            value={step.outcomeId ?? ""}
            onChange={(event) =>
              onChange(
                updateStep(document, step.id, {
                  outcomeId:
                    event.target.value === "" ? null : event.target.value,
                }),
              )
            }
          >
            <option value="">No outcome</option>
            {Object.values(document.outcomes).map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* The two moves that change the Journey's shape around this Step,
          kept together at the foot of the panel. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-4">
        {isStart ? (
          <span />
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(setStart(document, step.id))}
          >
            Make this the start
          </Button>
        )}
        <DeleteStepDialog
          key={`delete-${step.id}`}
          document={document}
          step={step}
          isStart={isStart}
          onDeleteStep={onDeleteStep}
        />
      </div>
    </section>
  );
}
