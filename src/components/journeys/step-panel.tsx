"use client";

import { useState } from "react";

import { ChoiceList } from "@/components/journeys/choice-list";
import { SELECT_CLASS } from "@/components/journeys/editor-shared";
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
import {
  choicesTargeting,
  setStart,
  stepName,
  updateStep,
} from "@/lib/graph/edit";
import { cn } from "@/lib/utils";

/**
 * One Step, opened for editing: its title, its rich text, its Choices, the
 * Outcome it carries once it is an Ending, and the two moves that change the
 * shape of the Journey around it — making it the Start and deleting it.
 */

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
            <ul
              role="list"
              aria-label="Affected choices"
              className="flex list-disc flex-col gap-1 pl-5 text-sm"
            >
              {affected.map((entry) => (
                <li key={entry.choice.id}>
                  {`${entry.choice.label.trim().length > 0 ? entry.choice.label : "Untitled choice"} on ${entry.stepTitle}`}
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

      {isStart ? (
        <span className="text-muted-foreground text-sm">
          Make another step the start first
        </span>
      ) : null}
    </div>
  );
}

export function StepPanel({
  document,
  step,
  onChange,
  onSelectStep,
  onContentChange,
  onContentRefused,
  onDeleteStep,
}: {
  document: GraphDocument;
  step: Step;
  onChange: (document: GraphDocument) => void;
  onSelectStep: (stepId: string) => void;
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium tracking-tight">{stepName(step)}</h3>
        {isStart ? null : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(setStart(document, step.id))}
          >
            Make this the start
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="step-title">Step title</Label>
        <Input
          id="step-title"
          autoComplete="off"
          maxLength={200}
          value={step.title}
          onChange={(event) =>
            onChange(
              updateStep(document, step.id, { title: event.target.value }),
            )
          }
        />
      </div>

      <RichTextEditor
        stepId={step.id}
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

      <DeleteStepDialog
        key={`delete-${step.id}`}
        document={document}
        step={step}
        isStart={isStart}
        onDeleteStep={onDeleteStep}
      />
    </section>
  );
}
