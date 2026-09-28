import { useEffect, useMemo, useRef, useState } from "react";

import { Combobox, type ComboboxOption } from "@/components/journeys/combobox";
import {
  SELECT_CLASS,
  type AddedStep,
  type ApplyEdit,
  type ChoiceFocus,
  type SelectStep,
} from "@/components/journeys/editor-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasStep, type GraphDocument, type Step } from "@/lib/graph/document";
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
 * a Choice needs — choosing "New step" makes it, so an Author writing
 * forwards never has to go back and wire anything up. A Choice added with
 * "New step" leaves the panel on this Step, so the next "Add choice" lands
 * here too; the new Step is the box selected on the map, and a line under
 * the Choices offers to open it (ticket 79). Retargeting a row at "New step…"
 * still opens the Step it makes.
 *
 * Where a Choice leads is found the way a Step is found above the map: the
 * field names the Step the Choice points at, and typing part of another
 * Step's title picks it out of the whole Draft, which on a forty-step Journey
 * is the difference between reading a list and scrolling one.
 *
 * One row can be marked as the Choice in hand — the arrow the Author clicked
 * on the map, or the Choice they have just drawn there. Marked is all it is:
 * the row is ringed and reads as the current one, and nothing here takes the
 * keyboard off the map the Author is working on — unless the Author took the
 * arrow in hand from the keyboard (`focusChoice`), when the row's label field
 * is where the keyboard goes next (ticket 88).
 */

/** The sentinel a target field uses for "make me one". */
const NEW_STEP = "__new__";

/**
 * The offer every row's target field carries, whatever is typed into it.
 * One function for every row and every render: a new one each time would be
 * a new set of options to the field each time.
 */
const newStepOption = () => ({ id: NEW_STEP, name: "New step…" });

export function ChoiceList({
  document,
  step,
  order,
  choiceProblems,
  markedChoiceId,
  focusChoice = null,
  onChoiceFocused,
  added,
  onChange,
  onSelectStep,
  onChoiceAdded,
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
  /**
   * An ask for the keyboard to go to one Choice's label field here: each new
   * ask is answered once its row is drawn, and a Choice not on this Step is
   * no ask of this list's.
   */
  focusChoice?: ChoiceFocus | null;
  /**
   * The ask above answered: its label field has the keyboard. The ask is let
   * go of then, so a remount of the panel (Hide and Show panel, the sheet and
   * the column trading places) does not take the keyboard there again.
   */
  onChoiceFocused?: () => void;
  /**
   * The Step the last "Add choice" here made with "New step", offered for
   * editing under the Choices. Held by the Draft editor, which lets go of it
   * on every opening, undo, redo, and adopted Draft.
   */
  added: AddedStep | null;
  onChange: ApplyEdit;
  onSelectStep: SelectStep;
  /**
   * An "Add choice" landed: the New step it made — its box selected on the
   * map, with the panel left on this Step — or `null` when it pointed at a
   * Step already there.
   */
  onChoiceAdded: (stepId: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState<string>(NEW_STEP);

  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (focusChoice === null) return;
    const field = listRef.current?.querySelector<HTMLInputElement>(
      `input[data-choice-label="${CSS.escape(focusChoice.choiceId)}"]`,
    );
    if (field == null) return;
    field.focus();
    onChoiceFocused?.();
  }, [focusChoice, onChoiceFocused]);

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
      onChoiceAdded(created.stepId);
    } else {
      onChange(
        addChoice(document, step.id, { label, targetStepId: target }).document,
      );
      onChoiceAdded(null);
    }

    setLabel("");
    setTarget(NEW_STEP);
    setAdding(false);
  }

  const addedStepId =
    added !== null && hasStep(document, added.stepId) ? added.stepId : null;

  return (
    <div className="flex flex-col gap-3">
      {/* One level under the Editor tab's "Steps" (`h2`, in
          `draft-editor.tsx`), alongside the panel's "Problems" (ticket 78,
          axe `heading-order`). */}
      <h3 className="text-sm font-medium">Choices</h3>

      {/* The list and the "Added" line share one flex item, so the line's
          always-mounted live region takes no gap while it is empty. */}
      <div className="flex flex-col">
        {/* role="list" is explicit: the flex layout strips the list marker,
            and some browsers drop the implicit role with it. */}
        <ul
          ref={listRef}
          role="list"
          aria-label="Choices"
          className="flex flex-col gap-2"
        >
          {step.choices.map((choice, index) => {
            const dangling = !hasStep(document, choice.targetStepId);
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
                    data-choice-label={choice.id}
                    placeholder="What the participant clicks"
                    autoComplete="off"
                    className="w-56"
                    value={choice.label}
                    // Named as the field it is, so a label typed in one go is
                    // one thing to undo rather than one undo per letter.
                    onChange={(event) =>
                      onChange(
                        updateChoice(document, step.id, choice.id, {
                          label: event.target.value,
                        }),
                        { field: `choice-label:${choice.id}` },
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
                    // The stored id even when it dangles: no option matches
                    // it, so the list opens on the first, and the field's
                    // untouched Enter chooses nothing all the same.
                    chosenId={choice.targetStepId}
                    action={newStepOption}
                    onChoose={(targetStepId) =>
                      retarget(choice.id, targetStepId)
                    }
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

        {/* The Step just made, named the way the map names it, one click from
          the panel. The live region is always mounted, empty until there is
          something to say, so its first words are announced rather than
          arriving with it; each add mounts its words afresh (keyed by the
          add), so a second add that reads the same is announced too. */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            addedStepId !== null && "mt-3",
          )}
        >
          <p role="status" className="text-sm text-muted-foreground">
            {addedStepId !== null && added !== null ? (
              <span key={added.announcement}>
                {`Added "${stepName(document.steps[addedStepId])}"`}
              </span>
            ) : null}
          </p>
          {addedStepId !== null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectStep(addedStepId, { focusTitle: true })}
            >
              {`Edit ${stepName(document.steps[addedStepId])}`}
            </Button>
          ) : null}
        </div>
      </div>

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
