import { useMemo, useState } from "react";

import { Combobox, type ComboboxOption } from "@/components/journeys/combobox";
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
 *
 * Where a Choice leads is found the way a Step is found above the map: the
 * field names the Step the Choice points at, and typing part of another
 * Step's title picks it out of the whole Draft, which on a forty-step Journey
 * is the difference between reading a list and scrolling one.
 *
 * One row can be marked as the Choice in hand — the arrow the Author clicked
 * on the map, or the Choice they have just drawn there. Marked is all it is:
 * the row is ringed and reads as the current one, and nothing here takes the
 * keyboard off the map the Author is working on.
 */

/** The sentinel a target field uses for "make me one". */
const NEW_STEP = "__new__";

export function ChoiceList({
  document,
  step,
  order,
  choiceProblems,
  markedChoiceId,
  onChange,
  onSelectStep,
}: {
  document: GraphDocument;
  step: Step;
  /**
   * Step ids in the order the map lays the boxes out, so the Steps a Choice
   * can be pointed at read like the map rather than like the order they were
   * created in.
   */
  order: string[];
  /** This Step's own Choices' live publish problems, keyed by Choice id. */
  choiceProblems: Map<string, PublishProblem[]>;
  /**
   * The Choice here that is the one in hand — the arrow the Author has
   * selected on the map, drawn or clicked — or `null` when none is.
   */
  markedChoiceId: string | null;
  onChange: (document: GraphDocument) => void;
  onSelectStep: SelectStep;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState<string>(NEW_STEP);

  // Every Step is a valid Choice target, the current one included — a loop
  // is an ordinary path since ticket 18.
  const targetSteps = Object.values(document.steps);

  /** The same Steps, offered to a Choice row in the order the map draws them. */
  const targetOptions = useMemo<ComboboxOption[]>(
    () =>
      order.map((stepId) => ({
        id: stepId,
        name: stepName(document.steps[stepId]),
      })),
    [document, order],
  );

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
          const marked = choice.id === markedChoiceId;

          return (
            // The Choice in hand, said the two ways a row can say it: read
            // out as the current one, and ringed the way a field the Author
            // is working in is.
            <li
              key={choice.id}
              aria-current={marked ? "true" : undefined}
              className={cn(
                "flex flex-col gap-2 rounded-xl px-3 py-2",
                marked ? "ring-2 ring-ring" : "ring-1 ring-foreground/10",
              )}
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

                {/* The deleted Step's place, said in the field itself and
                    kept there until the Author points the Choice somewhere
                    real. */}
                <Combobox
                  label="Choice target"
                  labelHidden
                  listLabel="Steps"
                  emptyMessage="No steps match"
                  className="w-48"
                  options={targetOptions}
                  value={
                    dangling
                      ? "Missing step"
                      : stepName(document.steps[choice.targetStepId])
                  }
                  action={() => ({ id: NEW_STEP, name: "New step…" })}
                  onChoose={(targetStepId) => retarget(choice.id, targetStepId)}
                />
                {/* Where this Choice goes, one click away. */}
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
