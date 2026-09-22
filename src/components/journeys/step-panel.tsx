import { useId, useRef, useState } from "react";

import { ChoiceList } from "@/components/journeys/choice-list";
import { Combobox, type ComboboxOption } from "@/components/journeys/combobox";
import { DeleteStepDialog } from "@/components/journeys/delete-step-dialog";
import { counted, type SelectStep } from "@/components/journeys/editor-shared";
import { RichTextEditor } from "@/components/journeys/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Content } from "@/lib/graph/content";
import { isEnding, type GraphDocument, type Step } from "@/lib/graph/document";
import {
  createOutcomeForEnding,
  endingCountsByOutcome,
  renameOutcome,
  setEndingOutcome,
  setStart,
  updateStep,
} from "@/lib/graph/edit";
import type { PublishProblem } from "@/lib/graph/validate";

/**
 * One Step, opened for editing: its title, its rich text, its Choices, the
 * Outcome it carries once it is an Ending, and the two moves that change the
 * shape of the Journey around it — making it the Start and deleting it. The
 * title field is the Step's name on this panel; there is no heading repeating
 * it above.
 *
 * The panel can be put away, from the button above the title field, to give
 * the map the whole width; the map itself brings it back. Whether it is away
 * is the editor's to hold — the panel is simply not rendered while it is —
 * and the browser's to remember, never the Journey's.
 */

/** The sentinels the Outcome field uses for "none" and for "make me one". */
const NO_OUTCOME = "__none__";
const CREATE_OUTCOME = "__create__";

/**
 * The Outcome an Ending is grouped by, made, chosen, and renamed from the
 * Ending itself: every Outcome the Journey defines with the Endings it holds,
 * "No outcome" to let go of one, and — for a label no Outcome answers to yet
 * — "Create outcome “…”", which defines it and tags this Ending in one edit.
 * An Outcome the last Ending drops goes with it; there is nothing to remove
 * by hand.
 *
 * "Rename" turns the field into the label itself, which renames the Outcome
 * for every Ending sharing it: the id never moves, so every Ending keeps its
 * tag and so does every Run recorded against a Published Version that used it.
 */
function OutcomeField({
  document,
  step,
  onChange,
}: {
  document: GraphDocument;
  step: Step;
  onChange: (document: GraphDocument) => void;
}) {
  const labelFieldId = useId();

  /** The label being rewritten, or `null` while the field is the combobox. */
  const [renaming, setRenaming] = useState<string | null>(null);
  // Escape takes the field away, and a field taken away may or may not report
  // the focus it lost; this is how the blur that follows knows it was a
  // cancel rather than the Author clicking away from a rename they meant.
  const cancelledRef = useRef(false);

  const outcome =
    step.outcomeId !== null && Object.hasOwn(document.outcomes, step.outcomeId)
      ? document.outcomes[step.outcomeId]
      : null;

  const counts = endingCountsByOutcome(document);
  const options: ComboboxOption[] = [
    { id: NO_OUTCOME, name: "No outcome" },
    ...Object.values(document.outcomes).map((entry) => ({
      id: entry.id,
      name: entry.label,
      render: (
        <>
          <span className="text-sm font-medium">{entry.label}</span>
          <span className="text-muted-foreground text-sm">
            {counted(counts[entry.id] ?? 0, "ending")}
          </span>
        </>
      ),
    })),
  ];

  /** Offered for a label the Journey has no Outcome for, and only then. */
  function createOption(query: string): ComboboxOption | null {
    const label = query.trim();
    if (label.length === 0) return null;
    if (Object.values(document.outcomes).some((entry) => entry.label === label))
      return null;

    return { id: CREATE_OUTCOME, name: `Create outcome “${label}”` };
  }

  function choose(outcomeId: string, query: string) {
    if (outcomeId === CREATE_OUTCOME) {
      onChange(createOutcomeForEnding(document, step.id, query).document);
      return;
    }

    onChange(
      setEndingOutcome(
        document,
        step.id,
        outcomeId === NO_OUTCOME ? null : outcomeId,
      ),
    );
  }

  function commitRename() {
    if (outcome === null || renaming === null) return;

    onChange(renameOutcome(document, outcome.id, renaming));
    setRenaming(null);
  }

  if (renaming !== null && outcome !== null) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={labelFieldId}>Outcome label</Label>
        <Input
          id={labelFieldId}
          autoComplete="off"
          autoFocus
          className="w-64"
          value={renaming}
          onChange={(event) => setRenaming(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
              return;
            }
            if (event.key === "Escape") {
              cancelledRef.current = true;
              setRenaming(null);
            }
          }}
          onBlur={() => {
            if (cancelledRef.current) {
              cancelledRef.current = false;
              return;
            }
            commitRename();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Combobox
        label="Outcome"
        listLabel="Outcomes"
        emptyMessage="No outcomes match"
        className="w-64"
        options={options}
        action={createOption}
        value={outcome?.label ?? "No outcome"}
        onChoose={choose}
      />

      {/* Only while there is a label to rewrite. */}
      {outcome !== null ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            cancelledRef.current = false;
            setRenaming(outcome.label);
          }}
        >
          Rename
        </Button>
      ) : null}
    </div>
  );
}

export function StepPanel({
  document,
  step,
  order,
  problems,
  choiceProblems,
  revision,
  focusTitle,
  focusChoiceId,
  focusChoiceRequest,
  onChange,
  onSelectStep,
  onContentChange,
  onContentRefused,
  onDeleteStep,
  onDuplicateStep,
  onHidePanel,
}: {
  document: GraphDocument;
  step: Step;
  /** Step ids in the order the map lays the boxes out, for the Choice rows. */
  order: string[];
  /** The live publish problems addressed to this Step. */
  problems: PublishProblem[];
  /** This Step's own Choices' live publish problems, keyed by Choice id. */
  choiceProblems: Map<string, PublishProblem[]>;
  /** Bumped each time the Draft was replaced from outside the editor. */
  revision: number;
  /** True when this Step was just created from a Choice and wants a name. */
  focusTitle: boolean;
  /** A Choice on this Step whose label field is being asked for. */
  focusChoiceId: string | null;
  /** Bumped each time that was asked for, so asking twice focuses twice. */
  focusChoiceRequest: number;
  onChange: (document: GraphDocument) => void;
  onSelectStep: SelectStep;
  onContentChange: (stepId: string, content: Content) => void;
  onContentRefused: (error: string) => void;
  onDeleteStep: (stepId: string) => void;
  onDuplicateStep: (stepId: string) => void;
  /** The panel put away, leaving the map the whole width. */
  onHidePanel: () => void;
}) {
  const isStart = document.startStepId === step.id;

  return (
    <section
      aria-label="Step"
      className="flex flex-col gap-4 rounded-xl px-4 py-4 ring-1 ring-foreground/10"
    >
      {/* Above the title field and out of the way at the panel's edge: a
          thing done to the panel rather than to the Step it is showing. */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onHidePanel}>
          Hide panel
        </Button>
      </div>

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

      {problems.length > 0 ? (
        <section
          aria-label="Step problems"
          className="flex flex-col gap-2 rounded-xl px-4 py-3 ring-1 ring-destructive/40"
        >
          <h4 className="text-sm font-medium">Problems</h4>
          <ul
            role="list"
            aria-label="Step problems list"
            className="flex list-disc flex-col gap-1 pl-5 text-sm text-destructive"
          >
            {problems.map((problem) => (
              <li key={`${problem.code}-${problem.choiceId ?? ""}`}>
                {problem.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
        order={order}
        choiceProblems={choiceProblems}
        focusChoiceId={focusChoiceId}
        focusChoiceRequest={focusChoiceRequest}
        onChange={onChange}
        onSelectStep={onSelectStep}
      />

      {/* Only an Ending carries an Outcome; a Step a participant can walk on
          from has nothing to be grouped by yet. Keyed by Step for the same
          reason the Choices are: a rename begun on one Ending is that
          Ending's, not the next one's. */}
      {isEnding(step) ? (
        <OutcomeField
          key={`outcome-${step.id}`}
          document={document}
          step={step}
          onChange={onChange}
        />
      ) : null}

      {/* The moves that change the Journey's shape around this Step —
          making it the Start, duplicating it, and deleting it — kept
          together at the foot of the panel. Every Step, the Start included,
          can be duplicated; only the Start has no "Make this the start". */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {isStart ? null : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(setStart(document, step.id))}
            >
              Make this the start
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDuplicateStep(step.id)}
          >
            Duplicate
          </Button>
        </div>
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
