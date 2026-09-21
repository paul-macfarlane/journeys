"use client";

import { useState } from "react";

import { SELECT_CLASS } from "@/components/journeys/editor-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GraphDocument, Step } from "@/lib/graph/document";
import {
  addChoice,
  addChoiceToNewStep,
  moveChoice,
  removeChoice,
  retargetChoiceToNewStep,
  stepName,
  updateChoice,
} from "@/lib/graph/edit";
import { cn } from "@/lib/utils";

/**
 * The Choices on the Step in the panel: their labels, where each leads, the
 * order a participant reads them in, and the one motion that creates the Step
 * a Choice needs — choosing "New step" makes it and opens it, so an Author
 * writing forwards never has to go back and wire anything up.
 */

/** The sentinel a target `<select>` uses for "make me one". */
const NEW_STEP = "__new__";

export function ChoiceList({
  document,
  step,
  onChange,
  onSelectStep,
}: {
  document: GraphDocument;
  step: Step;
  onChange: (document: GraphDocument) => void;
  onSelectStep: (stepId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState<string>(NEW_STEP);

  // A Choice onto its own Step is a cycle `validateForPublish` reports, so it
  // is not offered here at all.
  const otherSteps = Object.values(document.steps).filter(
    (other) => other.id !== step.id,
  );

  function retarget(choiceId: string, value: string) {
    if (value === NEW_STEP) {
      const created = retargetChoiceToNewStep(document, step.id, choiceId);
      onChange(created.document);
      onSelectStep(created.stepId);
      return;
    }

    onChange(
      updateChoice(document, step.id, choiceId, { targetStepId: value }),
    );
  }

  function add() {
    if (target === NEW_STEP) {
      const created = addChoiceToNewStep(document, step.id, { label });
      onChange(created.document);
      onSelectStep(created.stepId);
    } else {
      onChange(
        addChoice(document, step.id, { label, targetStepId: target }).document,
      );
    }

    setLabel("");
    setTarget(NEW_STEP);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-medium">Choices</h4>

      {/* role="list" is explicit: the flex layout strips the list marker, and
          some browsers drop the implicit role with it. */}
      <ul role="list" aria-label="Choices" className="flex flex-col gap-2">
        {step.choices.map((choice, index) => {
          // Own property only: `steps` is a plain object parsed from JSON, so
          // a target id like "toString" must read as missing, not as a Step.
          const dangling = !Object.hasOwn(document.steps, choice.targetStepId);

          return (
            <li
              key={choice.id}
              className="flex flex-col gap-2 rounded-xl px-3 py-2 ring-1 ring-foreground/10"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Choice label"
                  autoComplete="off"
                  className="w-56"
                  value={choice.label}
                  onChange={(event) =>
                    onChange(
                      updateChoice(document, step.id, choice.id, {
                        label: event.target.value,
                      }),
                    )
                  }
                />

                <select
                  aria-label="Choice target"
                  className={cn(SELECT_CLASS, "w-48")}
                  value={dangling ? "" : choice.targetStepId}
                  onChange={(event) => retarget(choice.id, event.target.value)}
                >
                  {/* The deleted Step's place in the list, kept visible until
                      the Author points the Choice somewhere real. */}
                  {dangling ? (
                    <option value="" disabled>
                      Missing step
                    </option>
                  ) : null}
                  {otherSteps.map((other) => (
                    <option key={other.id} value={other.id}>
                      {stepName(other)}
                    </option>
                  ))}
                  <option value={NEW_STEP}>New step…</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={index === 0}
                  onClick={() =>
                    onChange(moveChoice(document, step.id, choice.id, "up"))
                  }
                >
                  Move up
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={index === step.choices.length - 1}
                  onClick={() =>
                    onChange(moveChoice(document, step.id, choice.id, "down"))
                  }
                >
                  Move down
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    onChange(removeChoice(document, step.id, choice.id))
                  }
                >
                  Remove choice
                </Button>
              </div>

              {dangling ? (
                <p className="text-sm text-destructive">
                  This choice points at a step that no longer exists
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl px-3 py-2 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-choice-label">Label</Label>
            <Input
              id="add-choice-label"
              autoComplete="off"
              className="w-56"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="add-choice-target">Target</Label>
            <select
              id="add-choice-target"
              className={cn(SELECT_CLASS, "w-48")}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value={NEW_STEP}>New step</option>
              {otherSteps.map((other) => (
                <option key={other.id} value={other.id}>
                  {stepName(other)}
                </option>
              ))}
            </select>
          </div>

          <Button size="sm" onClick={add}>
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAdding(false);
              setLabel("");
              setTarget(NEW_STEP);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          Add choice
        </Button>
      )}
    </div>
  );
}
