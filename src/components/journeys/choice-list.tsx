import { useEffect, useRef, useState } from "react";

import {
  SELECT_CLASS,
  type SelectStep,
} from "@/components/journeys/editor-shared";
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
import type { PublishProblem } from "@/lib/graph/validate";
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
  choiceProblems,
  focusChoiceId,
  focusChoiceRequest,
  onChange,
  onSelectStep,
}: {
  document: GraphDocument;
  step: Step;
  /** This Step's own Choices' live publish problems, keyed by Choice id. */
  choiceProblems: Map<string, PublishProblem[]>;
  /** A Choice here whose label field is being asked for — one drawn on the
   * map, or one whose arrow the Author clicked. */
  focusChoiceId: string | null;
  /** Bumped each time that was asked for, so asking twice focuses twice. */
  focusChoiceRequest: number;
  onChange: (document: GraphDocument) => void;
  onSelectStep: SelectStep;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState<string>(NEW_STEP);

  // The label fields, by Choice, so the one the map asks for can be given
  // focus without the panel knowing anything about how a row is built.
  const labelFields = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (focusChoiceId === null) return;

    const field = labelFields.current.get(focusChoiceId);
    if (field === undefined) return;

    field.focus();
    // Selected rather than left with a caret: what is there is either
    // nothing at all or a label the Author has just come back to rename.
    field.select();
  }, [focusChoiceId, focusChoiceRequest]);

  // Every Step is a valid Choice target, the current one included — a loop
  // is an ordinary path since ticket 18.
  const targetSteps = Object.values(document.steps);

  function retarget(choiceId: string, value: string) {
    if (value === NEW_STEP) {
      const created = retargetChoiceToNewStep(document, step.id, choiceId);
      onChange(created.document);
      onSelectStep(created.stepId, { focusTitle: true });
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
      onSelectStep(created.stepId, { focusTitle: true });
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
                  ref={(field) => {
                    if (field === null) {
                      labelFields.current.delete(choice.id);
                      return;
                    }
                    labelFields.current.set(choice.id, field);
                  }}
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
                  {targetSteps.map((other) => (
                    <option key={other.id} value={other.id}>
                      {stepName(other)}
                    </option>
                  ))}
                  <option value={NEW_STEP}>New step…</option>
                </select>
                {/* Where this Choice goes, one click away; "Leads here from"
                    on that Step is the way back. */}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={dangling}
                  onClick={() => onSelectStep(choice.targetStepId)}
                >
                  Open
                </Button>

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

              {(choiceProblems.get(choice.id) ?? []).map((problem) => (
                <p key={problem.code} className="text-sm text-destructive">
                  {problem.message}
                </p>
              ))}
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
              {targetSteps.map((other) => (
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
