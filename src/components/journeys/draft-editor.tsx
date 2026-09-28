"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent } from "react";

import {
  counted,
  dialogIsOpen,
  type SelectCommand,
} from "@/components/journeys/editor-shared";
import { FindStep } from "@/components/journeys/find-step";
import { StaleNotice } from "@/components/stale-notice";
import { JourneyCanvas } from "@/components/journeys/journey-canvas";
import { StepPanel } from "@/components/journeys/step-panel";
import { useDraftDocument } from "@/components/journeys/use-draft-document";
import { usePanelVisibility } from "@/components/journeys/use-panel-visibility";
import { useStepSelection } from "@/components/journeys/use-step-selection";
import type { Content } from "@/lib/graph/content";
import { hasStep, type GraphDocument } from "@/lib/graph/document";
import { runEditCommand, updateStep, type EditCommand } from "@/lib/graph/edit";
import { layoutGraph, mapOrder } from "@/lib/graph/layout";
import { indexProblems, validateForPublish } from "@/lib/graph/validate";
import { cn } from "@/lib/utils";
import { STATUS_TEXT } from "@/lib/autosave";

/**
 * The Draft editor: the map of the Journey beside a panel on the Step the
 * Author has open, with "Find step" above the map. Everything an Author
 * changes happens in the document this component holds; the server hears
 * about it through one autosave.
 *
 * Why the whole document rather than per-field actions: a Draft is one jsonb
 * row (see `docs/adr/0001-graph-as-one-json-document.md`), so the only write
 * there is to make is "store this document". Each save is guarded by the
 * Draft's version (ticket 73): a Member whose editor opened before another
 * Member's save is refused as stale, keeps their edit on screen, and
 * reloads to see the other change. Nothing is merged or overwritten.
 */

export function DraftEditor({
  projectId,
  journeyId,
  draft,
  version,
}: {
  projectId: string;
  journeyId: string;
  draft: GraphDocument;
  /** The Draft version `draft` was read at. */
  version: number;
}) {
  // The panel beside the map, the Step open in it, and the Draft itself,
  // in that order: an opening brings the panel back, and an undo, a redo,
  // and a refused save each open a Step.
  const {
    panelShown,
    fitRequest,
    hidePanel,
    showPanel,
    revealPanel,
    panelRef,
    requestPanelScroll,
  } = usePanelVisibility();
  const {
    selectedStepId,
    selectedStepIdRef,
    selectStep,
    mapOnlyStepId,
    added,
    choiceAdded,
    titleFocusStepId,
    arrowSelection,
    selectArrow,
    locate,
    adoptDraft,
  } = useStepSelection({
    startStepId: draft.startStepId,
    revealPanel,
    requestPanelScroll,
  });
  const {
    document,
    documentRef,
    revision,
    status,
    reload,
    saveError,
    flushSave,
    applyEdit,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDraftDocument({
    projectId,
    journeyId,
    draft,
    version,
    selectedStepIdRef,
    selectStep,
    adoptSelection: adoptDraft,
  });

  // Whether the live "All problems" list is open. Left as the Author set it
  // across document changes — it is the count reaching zero, not a toggle,
  // that ever makes the section disappear on its own.
  const [liveProblemsOpen, setLiveProblemsOpen] = useState(false);
  // Something the rich text surface refused on the Author's behalf, shown
  // while that Step stays selected.
  const [contentNotice, setContentNotice] = useState<{
    stepId: string;
    message: string;
  } | null>(null);
  /**
   * Counts the times Cmd/Ctrl+K asked for the "Find step" field, so a second
   * press puts the Author back in it with what they typed selected.
   */
  const [findFocusRequest, setFindFocusRequest] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+K from anywhere on the Journey page is the way into "Find step",
  // wherever the Author's hands happen to be. On `window` rather than on the
  // field, because the point of it is not having to reach for the field; the
  // Journey page is the only page that mounts this editor, so nothing else in
  // the app hears it. A press something else has already answered is left
  // alone. So is a press carrying Shift or Alt as well, which is a different
  // shortcut entirely — the browser's own among them — and not this one. And
  // so is any press made while a dialog is open: the keyboard belongs to the
  // dialog, and pulling focus to a field behind it would leave the Author
  // typing into something they cannot see.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "k") return;
      if (dialogIsOpen()) return;

      event.preventDefault();
      setFindFocusRequest((current) => current + 1);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /** Focus leaving the editor entirely is the Author pausing: write now. */
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next !== null && rootRef.current?.contains(next)) return;
    void flushSave();
  }

  const handleContentChange = useCallback(
    (stepId: string, content: Content) => {
      // The Step's own surface is a field like any other: a run of typing in
      // it is one thing to undo, and an undo of it opens the Step it was
      // typed on even if the Author has since moved to another.
      applyEdit(updateStep(documentRef.current, stepId, { content }), {
        stepId,
        field: `content:${stepId}`,
      });
    },
    [applyEdit, documentRef],
  );

  /**
   * A selected arrow can outlive the Choice it draws — deleted here, or by
   * another Member's write — so what the map is handed is the selection only
   * while the document still has it, the way `selectedStep` is below.
   */
  const selectedArrow = useMemo(() => {
    if (arrowSelection === null) return null;

    const step = hasStep(document, arrowSelection.stepId)
      ? document.steps[arrowSelection.stepId]
      : null;
    const alive =
      step?.choices.some((choice) => choice.id === arrowSelection.choiceId) ??
      false;
    return alive ? arrowSelection : null;
  }, [document, arrowSelection]);

  /**
   * Every edit the map asks for, as one command: run against the document
   * the handlers see, applied through `applyEdit` with the Step it belongs
   * to, and followed by whatever opening of a Step that edit asks for.
   */
  const handleEdit = useCallback(
    (command: EditCommand) => {
      const before = documentRef.current;
      const outcome = runEditCommand(before, command);

      switch (command.kind) {
        /** "Add step": the new Step opened, with the map zoomed to where it landed. */
        case "add-step":
          if (outcome.stepId === null) return;
          applyEdit(outcome.document);
          selectStep(outcome.stepId, { focusTitle: true, zoom: true });
          return;

        /**
         * "Add next step" on a box's toolbar: the Step and the Choice that
         * reaches it in one motion, opened with its title field focused so
         * the Author names it in the same breath, and the map zoomed to the
         * box it landed on. The label is left empty — what the Choice is
         * called is the next thing to write, on the Step it leaves.
         *
         * Shared by "Add next step" (a box's toolbar or the panel footer)
         * and an arrow drawn from a box onto bare map: both make a new Step
         * and a Choice to it in the same motion, with nothing to tell them
         * apart.
         *
         * "Duplicate" on a box's toolbar or the panel footer: a copy of the
         * Step with no Choices, opened with its title field focused so the
         * Author can rename it right away — the same opening "Add next step"
         * gives a new one.
         */
        case "add-next-step":
        case "duplicate-step":
          if (outcome.stepId === null) return;
          applyEdit(outcome.document, { stepId: command.stepId });
          selectStep(outcome.stepId, { focusTitle: true, zoom: true });
          return;

        /** The head of an arrow dropped on another box, and "Make this the start". */
        case "set-start":
        case "retarget-choice":
          applyEdit(outcome.document, { stepId: command.stepId });
          return;

        /**
         * Which way the map runs, asked for from the control on the canvas.
         * A property of the Journey rather than of the browser looking at
         * it, so it takes the same path as every other edit: into the
         * document, out through the one autosave, and on to the next Member
         * who opens the Draft.
         */
        case "set-layout-direction":
          applyEdit(outcome.document);
          return;

        /**
         * An arrow drawn from one box onto another: the Choice exists the
         * moment the Author lets go, and the panel opens on the Step it
         * leaves with the new row marked — the drag said where the Choice
         * goes, not what it says, and the Author's hands are still on the
         * map.
         */
        case "connect-choice":
          if (outcome.choiceId === null) return;
          applyEdit(outcome.document, { stepId: command.stepId });
          selectStep(command.stepId, { markChoiceId: outcome.choiceId });
          return;

        /** The Delete key on a selected arrow, which is the panel's "Remove choice". */
        case "remove-choices":
          if (outcome.document === before) return;
          // The Step the first arrow left: where an undo of this puts the
          // Author back, whatever the map had selected by then.
          applyEdit(outcome.document, { stepId: command.choices[0].stepId });
          return;

        case "delete-step":
          // Refused only for the Start, which cannot go while it is the
          // Start; a Step already gone deletes nothing but is answered the
          // same as one that went.
          if (
            hasStep(before, command.stepId) &&
            before.startStepId === command.stepId
          ) {
            return;
          }
          // The Step that goes: an undo brings it back, and brings the
          // Author back to it.
          applyEdit(outcome.document, { stepId: command.stepId });
          // The arrow in hand is let go of and no Choice's label is asked
          // for, and the view is left exactly as it was: a Step going is not
          // somewhere the Author asked to be taken.
          selectStep(outcome.document.startStepId, { keepView: true });
          return;
      }
    },
    [applyEdit, documentRef, selectStep],
  );

  /** The panel's own "Delete step" and "Duplicate", the same edits as the map's. */
  const removeStep = useCallback(
    (stepId: string) => handleEdit({ kind: "delete-step", stepId }),
    [handleEdit],
  );
  const duplicate = useCallback(
    (stepId: string) => handleEdit({ kind: "duplicate-step", stepId }),
    [handleEdit],
  );

  /** Everything else the map asks for, handed to what already does it. */
  const handleSelect = useCallback(
    (command: SelectCommand) => {
      switch (command.kind) {
        case "step":
          selectStep(command.stepId, command.options);
          return;
        case "arrow":
          selectArrow(command.arrow);
          return;
        case "show-panel":
          showPanel();
          return;
        case "hide-panel":
          hidePanel();
          return;
        case "undo":
          undo();
          return;
        case "redo":
          redo();
          return;
      }
    },
    [hidePanel, redo, selectArrow, selectStep, showPanel, undo],
  );

  // What the canvas marks: the same rules the Publish button applies, run
  // here on what the Author is holding rather than on what was last stored,
  // so a mark appears and clears as the document changes. Publishing is the
  // only server-side question left; these and its refusal read the same.
  const liveProblems = useMemo(() => validateForPublish(document), [document]);

  // The document laid out once: the map draws from it, and "Find step" above
  // the map reads its order off the same boxes rather than laying the whole
  // document out a second time on every change.
  const layout = useMemo(() => layoutGraph(document), [document]);
  const stepOrder = useMemo(() => mapOrder(layout), [layout]);

  // The same problems, indexed by Step and by Choice, so the canvas and the
  // panel can each look up what belongs to them without deriving it twice.
  const problemIndex = useMemo(
    () => indexProblems(liveProblems),
    [liveProblems],
  );

  const steps = Object.values(document.steps);
  // The Draft is one Step with no Choices — what a brand-new Journey starts
  // as. The hint above the map is shown whenever that holds, and only then.
  const isNewDraft = steps.length === 1 && steps[0].choices.length === 0;
  const summary = [
    counted(steps.length, "step"),
    counted(Object.keys(document.outcomes).length, "outcome"),
  ].join(" · ");

  // A selection can outlive the Step it names — a restore, or another
  // Member's delete — so the Start stands in until the Author picks again.
  const selectedStep = hasStep(document, selectedStepId)
    ? document.steps[selectedStepId]
    : (document.steps[document.startStepId] ?? null);

  return (
    <div ref={rootRef} onBlur={handleBlur} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium tracking-tight">Steps</h2>
          <p className="text-muted-foreground text-sm">{summary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {status === "stale" ? (
            <StaleNotice noun="draft" onReload={reload} />
          ) : (
            // Named, because it is not the tabpanel's only status: the
            // panel's "Added …" line under the Choices is another. The name
            // is for finding it; what a screen reader announces is the
            // text inside as it changes ("Saving…", "Saved").
            <p
              role="status"
              aria-label="Draft save status"
              className="text-muted-foreground text-sm"
            >
              {STATUS_TEXT[status]}
            </p>
          )}
          {liveProblems.length > 0 ? (
            <button
              type="button"
              aria-expanded={liveProblemsOpen}
              className="text-sm text-destructive underline underline-offset-4"
              onClick={() => setLiveProblemsOpen((current) => !current)}
            >
              {counted(liveProblems.length, "problem")}
            </button>
          ) : (
            <p className="text-muted-foreground text-sm">No problems</p>
          )}
          {/* "Add step" lives on the canvas, beside the map it adds to. */}
        </div>
      </div>

      {liveProblemsOpen && liveProblems.length > 0 ? (
        <section
          aria-label="Live problems"
          className="flex flex-col gap-2 rounded-xl px-4 py-3 ring-1 ring-destructive/40"
        >
          {/* role="list" is explicit for consistency with the app's other
              lists. One rule can name the same Step more than once (one entry
              per dangling Choice), so the Choice id is part of the key. */}
          <ul
            role="list"
            aria-label="All problems"
            className="flex list-disc flex-col gap-1 pl-5 text-sm"
          >
            {liveProblems.map((problem, index) => {
              const { stepId } = problem;
              return (
                <li
                  key={`${problem.code}-${stepId ?? ""}-${problem.choiceId ?? index}`}
                >
                  {stepId !== undefined ? (
                    <button
                      type="button"
                      className="text-left text-destructive underline underline-offset-4"
                      onClick={() => selectStep(stepId)}
                    >
                      {problem.message}
                    </button>
                  ) : (
                    problem.message
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {saveError ? (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm text-destructive ring-1 ring-destructive/40"
        >
          {`Couldn't save: ${saveError}`}
        </p>
      ) : null}

      {/* A notice about one Step's surface has nothing to say about the next. */}
      {contentNotice && contentNotice.stepId === selectedStep?.id ? (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm text-destructive ring-1 ring-destructive/40"
        >
          {contentNotice.message}
        </p>
      ) : null}

      {/* The one hint a brand-new Draft gets (ticket 57): a plain paragraph,
          not a live region — it is there from the page's first paint, with
          nothing arriving to announce. Set directly above the map rather than
          over it, so it is never a click this Author aims at the canvas could
          land on instead. */}
      {isNewDraft ? (
        <p className="text-muted-foreground text-sm">
          Write the Start Step in the panel, then add a Choice to make the next
          Step.{" "}
          <Link
            href="/guide#the-canvas"
            className="underline underline-offset-4"
          >
            How the canvas works
          </Link>
        </p>
      ) : null}

      {/* The panel's column closes to nothing when it is put away and the map
          takes the width, both slid rather than snapped: two `minmax` columns
          of the same shape are two the browser can move between, where a
          `0fr` is one it can only jump to. The gap between the columns closes
          with them, or the map would stop 24px short of the edge. The map
          re-fits itself to each width the slide hands it, so no width here is
          announced to it. */}
      <div
        className={cn(
          "grid gap-6 transition-[grid-template-columns,gap] duration-200 motion-reduce:transition-none",
          panelShown
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
            : "lg:grid-cols-[minmax(0,1fr)_minmax(0,0rem)] lg:gap-0",
        )}
      >
        <JourneyCanvas
          document={document}
          layout={layout}
          problems={problemIndex}
          selection={{
            stepId:
              mapOnlyStepId !== null && hasStep(document, mapOnlyStepId)
                ? mapOnlyStepId
                : (selectedStep?.id ?? ""),
            arrow: selectedArrow,
          }}
          view={{ locate, fitRequest, panelShown, canUndo, canRedo }}
          // In the row of controls above the map, because what it finds is
          // on the map.
          findStep={
            <FindStep
              document={document}
              order={stepOrder}
              focusRequest={findFocusRequest}
              onSelectStep={selectStep}
            />
          }
          onEdit={handleEdit}
          onSelect={handleSelect}
        />

        {/* Nothing of a panel that is away is left behind to be tabbed into
            or read out: the column closes over it and it is not rendered. */}
        <div ref={panelRef} className="min-w-0 overflow-hidden">
          {selectedStep && panelShown ? (
            <StepPanel
              document={document}
              step={selectedStep}
              order={stepOrder}
              problems={problemIndex}
              revision={revision}
              focusTitle={titleFocusStepId === selectedStep.id}
              markedChoiceId={
                selectedArrow?.stepId === selectedStep.id
                  ? selectedArrow.choiceId
                  : null
              }
              onChange={applyEdit}
              onSelectStep={selectStep}
              added={added}
              onChoiceAdded={choiceAdded}
              onContentChange={handleContentChange}
              onContentRefused={(message) =>
                setContentNotice({ stepId: selectedStep.id, message })
              }
              onDeleteStep={removeStep}
              onDuplicateStep={duplicate}
              onHidePanel={hidePanel}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
