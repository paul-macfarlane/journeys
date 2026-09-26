import { useCallback, useId, useMemo, useRef, useState } from "react";

import { ChoiceList } from "@/components/journeys/choice-list";
import {
  SelectCombobox,
  type ComboboxOption,
} from "@/components/journeys/combobox";
import { DeleteStepDialog } from "@/components/journeys/delete-step-dialog";
import {
  counted,
  type ApplyEdit,
  type SelectStep,
} from "@/components/journeys/editor-shared";
import { RichTextEditor } from "@/components/journeys/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Content } from "@/lib/graph/content";
import {
  hasOutcome,
  isEnding,
  type GraphDocument,
  type Step,
} from "@/lib/graph/document";
import {
  createOutcomeForEnding,
  endingCountsByOutcome,
  renameOutcome,
  setEndingOutcome,
  setStart,
  setStepPrompt,
  updateStep,
} from "@/lib/graph/edit";
import { isDeciding } from "@/lib/graph/prompt";
import type { PublishProblem } from "@/lib/graph/validate";

/**
 * One Step, opened for editing: its title, its rich text, its Prompt, its
 * Choices, the Outcome it carries once it is an Ending, and the two moves
 * that change the shape of the Journey around it — making it the Start and
 * deleting it. The title field is the Step's name on this panel; there is no
 * heading repeating it above.
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
 * Ending itself, on a control that reads as a select: what the Ending carries
 * (or "No outcome") until it is opened, and then a filter over every Outcome
 * the Journey defines with the Endings it holds, "No outcome" to let go of
 * one, and — for a label no Outcome answers to yet
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
  onChange: ApplyEdit;
}) {
  const labelFieldId = useId();

  /** The label being rewritten, or `null` while the field is the combobox. */
  const [renaming, setRenaming] = useState<string | null>(null);
  // Escape takes the field away, and a field taken away may or may not report
  // the focus it lost; this is how the blur that follows knows it was a
  // cancel rather than the Author clicking away from a rename they meant.
  const cancelledRef = useRef(false);

  const outcome =
    step.outcomeId !== null && hasOutcome(document, step.outcomeId)
      ? document.outcomes[step.outcomeId]
      : null;

  // Held still across renders, both of them: the field re-reads its options
  // whenever this array or this function is a new one, and the Draft changes
  // under the panel on every keystroke elsewhere in it.
  const options = useMemo<ComboboxOption[]>(() => {
    const counts = endingCountsByOutcome(document);
    return [
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
      { id: NO_OUTCOME, name: "No outcome" },
    ];
  }, [document]);

  /**
   * Offered for a label the Journey has no Outcome for, and only then: two
   * labels differing in their spacing or their case are the same label to an
   * Author, so neither is a reason to offer them a second Outcome.
   */
  const createOption = useCallback(
    (query: string): ComboboxOption | null => {
      const label = query.trim();
      if (label.length === 0) return null;
      if (
        Object.values(document.outcomes).some(
          (entry) => entry.label.trim().toLowerCase() === label.toLowerCase(),
        )
      ) {
        return null;
      }

      return { id: CREATE_OUTCOME, name: `Create outcome “${label}”` };
    },
    [document],
  );

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

    // An Outcome with nothing for a label is no Outcome an Author can read
    // off an Ending, so a field cleared and committed is a rename let go of
    // rather than a label taken away: the Outcome keeps the one it had.
    const label = renaming.trim();
    setRenaming(null);
    if (label.length === 0) return;

    // Named as the Outcome's own field: a rename committed, thought better
    // of, and committed again within the moment is one thing to undo.
    onChange(renameOutcome(document, outcome.id, label), {
      field: `outcome-label:${outcome.id}`,
    });
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
      <SelectCombobox
        label="Outcome"
        listLabel="Outcomes"
        filterLabel="Filter outcomes"
        filterPlaceholder="Filter or create…"
        emptyMessage="No outcomes match"
        className="w-64"
        options={options}
        action={createOption}
        value={outcome?.label ?? "No outcome"}
        chosenId={outcome?.id ?? NO_OUTCOME}
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

/**
 * The Prompt a Step asks before its Choices, edited where it sits between
 * the rich text and the Choices — the order a Participant meets them in.
 * The one field is the question: writing one attaches a Prompt, and
 * blanking it takes the Prompt away, so there is no "Add prompt" to find.
 * "Required" is offered only while there is a Prompt to require. The notice
 * is always there, because it is about the Author's question, not the
 * Participant's answer: Responses are anonymous, and an Author who asks for
 * a name has collected something the app promised never to hold.
 */
function PromptField({
  document,
  step,
  onChange,
}: {
  document: GraphDocument;
  step: Step;
  onChange: ApplyEdit;
}) {
  const labelFieldId = useId();
  const requiredFieldId = useId();
  const decidesFieldId = useId();
  const decidesReasonId = useId();
  const required = step.prompt?.required ?? false;
  const decides = step.prompt?.decides ?? false;
  // Deciding needs a Choice to land on, and a choice between them: one
  // Choice is already where a Response leads without any judging.
  const canDecide = step.choices.length >= 2;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={labelFieldId}>Prompt</Label>
      <Input
        id={labelFieldId}
        autoComplete="off"
        placeholder="Something participants respond to before choosing"
        value={step.prompt?.label ?? ""}
        // Named as the field it is, like the title: a question typed in one
        // go comes back in one undo.
        onChange={(event) =>
          onChange(
            setStepPrompt(document, step.id, {
              label: event.target.value,
              required,
              decides,
            }),
            { field: `prompt-label:${step.id}` },
          )
        }
      />
      <p className="text-muted-foreground text-xs">
        Responses are anonymous. Don&apos;t ask for a name or anything else that
        could identify a participant.
      </p>
      {step.prompt !== null ? (
        <div className="flex items-center gap-2">
          <input
            id={requiredFieldId}
            type="checkbox"
            className="size-4 accent-primary"
            checked={decides || required}
            disabled={isDeciding(step)}
            onChange={(event) =>
              onChange(
                setStepPrompt(document, step.id, {
                  label: step.prompt?.label ?? "",
                  required: event.target.checked,
                  decides,
                }),
              )
            }
          />
          <Label htmlFor={requiredFieldId} className="font-normal">
            Required — participants must answer before choosing
          </Label>
        </div>
      ) : null}
      {/*
       * Always offered once there is a Prompt (ticket 49), so an Author who
       * writes the question before the Choices still sees what a Prompt can
       * do: off and unavailable until there are two Choices to pick between,
       * with the reason beside it. Turned on and then left with too few (a
       * Choice removed after the fact) it stays enabled, so it can be turned
       * off, and the same reason says it is not deciding meanwhile.
       */}
      {step.prompt !== null ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              id={decidesFieldId}
              type="checkbox"
              className="peer size-4 accent-primary"
              checked={decides}
              disabled={!canDecide && !decides}
              aria-describedby={canDecide ? undefined : decidesReasonId}
              onChange={(event) =>
                onChange(
                  setStepPrompt(document, step.id, {
                    label: step.prompt?.label ?? "",
                    required,
                    decides: event.target.checked,
                  }),
                )
              }
            />
            <Label htmlFor={decidesFieldId} className="font-normal">
              AI decides the next step from the response
            </Label>
          </div>
          {canDecide ? null : (
            <p id={decidesReasonId} className="text-muted-foreground text-xs">
              Needs two or more choices.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            An AI judge reads the response and picks the choice it fits.
            Participants choose for themselves when it&apos;s unsure or
            unavailable.
          </p>
          <p className="text-muted-foreground text-xs">
            Participants answer and press Continue; the choices appear only when
            the judge is unsure or unavailable.
          </p>
        </div>
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
  markedChoiceId,
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
  /** A Choice on this Step that is the one in hand on the map, if any. */
  markedChoiceId: string | null;
  onChange: ApplyEdit;
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
          // Named as the field it is, so a title typed in one go comes back
          // in one undo rather than a letter at a time.
          onChange={(event) =>
            onChange(
              updateStep(document, step.id, { title: event.target.value }),
              { field: `title:${step.id}` },
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

      {/* No undo of its own: the Draft keeps one over the whole document,
          and Cmd/Ctrl+Z in here belongs to that one. */}
      <RichTextEditor
        resetKey={`${step.id}:${revision}`}
        content={step.content}
        history={false}
        onChange={(content) => onContentChange(step.id, content)}
        onRefused={onContentRefused}
      />

      {/* Between the text and the Choices, where a Participant meets it. */}
      <PromptField document={document} step={step} onChange={onChange} />

      {/* Keyed by Step: the half-typed Choice and the open confirmation
          belong to the Step they were started on, not to the next one. The
          two keys are prefixed because they are siblings. */}
      <ChoiceList
        key={`choices-${step.id}`}
        document={document}
        step={step}
        order={order}
        choiceProblems={choiceProblems}
        markedChoiceId={markedChoiceId}
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
          can be duplicated; only the Start has neither "Make this the start"
          nor "Delete step". */}
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
        {/* The Start has no "Delete step" at all: it cannot be deleted while
            it is the Start, and a button that only ever refuses is a button
            that should not be there. */}
        {isStart ? null : (
          <DeleteStepDialog
            key={`delete-${step.id}`}
            document={document}
            step={step}
            onDeleteStep={onDeleteStep}
          />
        )}
      </div>
    </section>
  );
}
