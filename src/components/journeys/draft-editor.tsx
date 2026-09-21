"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";

import {
  saveDraftAction,
  validateDraftAction,
  type SaveDraftActionResult,
} from "@/app/projects/[projectId]/journeys/actions";
import { counted, type SelectStep } from "@/components/journeys/editor-shared";
import { OutcomeList } from "@/components/journeys/outcome-list";
import { StepList } from "@/components/journeys/step-list";
import { StepPanel } from "@/components/journeys/step-panel";
import { Button } from "@/components/ui/button";
import type { Content } from "@/lib/graph/content";
import { documentsEqual, type GraphDocument } from "@/lib/graph/document";
import { addStep, deleteStep, updateStep } from "@/lib/graph/edit";
import type { PublishProblem } from "@/lib/graph/validate";

/**
 * The Draft editor: a step list beside a panel, with the Journey's Outcomes
 * above the list. Everything an Author changes happens in the document this
 * component holds; the server hears about it through one autosave.
 *
 * Why the whole document rather than per-field actions: a Draft is one jsonb
 * row (see `docs/adr/0001-graph-as-one-json-document.md`), so the only write
 * there is to make is "store this document". Last write wins, as the spec
 * says: a Member who saves later overwrites what an earlier one stored.
 */

/** Long enough that a sentence is one save, short enough to feel immediate. */
const SAVE_DEBOUNCE_MS = 600;

type SaveStatus = "saved" | "saving" | "unsaved";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
};

export function DraftEditor({
  projectId,
  journeyId,
  draft,
}: {
  projectId: string;
  journeyId: string;
  draft: GraphDocument;
}) {
  const router = useRouter();

  const [document, setDocument] = useState<GraphDocument>(draft);
  const [selectedStepId, setSelectedStepId] = useState(draft.startStepId);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [problems, setProblems] = useState<PublishProblem[] | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  // Something the rich text surface did on the Author's behalf (removing a
  // pasted image that had no credit), shown while that Step stays selected.
  const [contentNotice, setContentNotice] = useState<{
    stepId: string;
    message: string;
  } | null>(null);
  // Counts the times the Draft was replaced from outside this editor, so the
  // rich text surface can be re-fed even when the selected Step is the same.
  const [revision, setRevision] = useState(0);

  // The save loop reads these rather than state: it runs from a timer and
  // from an event handler, both of which would otherwise see whatever render
  // they were created in.
  const documentRef = useRef(draft);
  const lastSavedRef = useRef(draft);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * One save in flight at a time with at most one waiting behind it: an edit
   * during a save sets the flag, and the loop picks up whatever the document
   * has become rather than queueing a save per keystroke.
   */
  const save = useCallback(async () => {
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }
    savingRef.current = true;

    try {
      for (;;) {
        const pending = documentRef.current;
        if (documentsEqual(pending, lastSavedRef.current)) {
          setStatus("saved");
          return;
        }

        setStatus("saving");
        const result = await saveDraftAction(
          projectId,
          journeyId,
          pending,
        ).catch((): SaveDraftActionResult => ({
          ok: false,
          error: "the server could not be reached",
        }));

        if (!result.ok) {
          // Editing continues and the next edit retries; nothing the Author
          // has typed is thrown away because a write failed.
          setSaveError(result.error);
          setStatus("unsaved");
          queuedRef.current = false;
          if (
            result.stepId !== undefined &&
            Object.hasOwn(documentRef.current.steps, result.stepId)
          ) {
            setSelectedStepId(result.stepId);
          }
          return;
        }

        setSaveError(null);
        lastSavedRef.current = pending;

        if (!documentsEqual(documentRef.current, pending)) {
          // An edit arrived during the save. A flush asked for it to be
          // written now; otherwise its own timer is about to ask, and the
          // status stays "unsaved" until it does.
          if (queuedRef.current) {
            queuedRef.current = false;
            continue;
          }
          return;
        }
        queuedRef.current = false;

        setStatus("saved");
        // Only with nothing left to write: the refresh is what lets the
        // Publish button notice the Draft has moved, and a refresh landing
        // mid-edit would only be answered by another one.
        router.refresh();
        return;
      }
    } finally {
      savingRef.current = false;
    }
  }, [journeyId, projectId, router]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Waits out a save already running, then writes whatever is still unsaved. */
  const flushSave = useCallback(async () => {
    clearTimer();
    while (savingRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await save();
  }, [clearTimer, save]);

  const applyEdit = useCallback(
    (next: GraphDocument) => {
      documentRef.current = next;
      setDocument(next);
      setStatus("unsaved");

      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void save();
      }, SAVE_DEBOUNCE_MS);
    },
    [clearTimer, save],
  );

  /**
   * A `draft` that differs from what was last stored is someone else's write
   * or a restore, and last write wins: the editor adopts it. A `draft` equal
   * to it is this editor's own save coming back around, and is ignored.
   */
  useEffect(() => {
    if (documentsEqual(draft, lastSavedRef.current)) return;
    // A render the server started before the latest save can arrive after
    // it. While an edit is unsaved or a save is running, what is here is
    // newer than anything the server can show, so nothing is adopted; the
    // save about to happen wins, as last write does.
    if (
      savingRef.current ||
      timerRef.current !== null ||
      !documentsEqual(documentRef.current, lastSavedRef.current)
    ) {
      return;
    }

    lastSavedRef.current = draft;
    documentRef.current = draft;
    setDocument(draft);
    setStatus("saved");
    setRevision((current) => current + 1);
    setSelectedStepId((current) =>
      Object.hasOwn(draft.steps, current) ? current : draft.startStepId,
    );
  }, [draft]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Leaving the page with an edit still in the debounce window: the write is
  // attempted, and the browser asks before the page goes, because neither the
  // attempt nor the answer is something this can wait for.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (documentsEqual(documentRef.current, lastSavedRef.current)) return;

      void saveDraftAction(projectId, journeyId, documentRef.current).catch(
        () => {},
      );
      event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [journeyId, projectId]);

  /** Focus leaving the editor entirely is the Author pausing: write now. */
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next !== null && rootRef.current?.contains(next)) return;
    void flushSave();
  }

  const handleContentChange = useCallback(
    (stepId: string, content: Content) => {
      applyEdit(updateStep(documentRef.current, stepId, { content }));
    },
    [applyEdit],
  );

  // The Step whose title field should take focus when it opens: one that was
  // just created and has only "Untitled step" for a name.
  const [titleFocusStepId, setTitleFocusStepId] = useState<string | null>(null);

  const selectStep: SelectStep = useCallback((stepId, options) => {
    setSelectedStepId(stepId);
    setTitleFocusStepId(options?.focusTitle ? stepId : null);
  }, []);

  function addNewStep() {
    const created = addStep(documentRef.current);
    applyEdit(created.document);
    selectStep(created.stepId, { focusTitle: true });
  }

  function removeStep(stepId: string) {
    const result = deleteStep(documentRef.current, stepId);
    if (!result.ok) return;

    applyEdit(result.document);
    setSelectedStepId(result.document.startStepId);
  }

  async function validate() {
    setValidating(true);
    setValidateError(null);
    try {
      // Validation reads the stored Draft, so what is on screen has to be
      // what is stored before it is worth asking.
      await flushSave();
      const result = await validateDraftAction(projectId, journeyId);

      if (!result.ok) {
        setProblems(null);
        setValidateError(result.error);
        return;
      }
      setProblems(result.problems);
    } finally {
      setValidating(false);
    }
  }

  const steps = Object.values(document.steps);
  const summary = [
    counted(steps.length, "step"),
    counted(Object.keys(document.outcomes).length, "outcome"),
  ].join(" · ");

  // A selection can outlive the Step it names — a restore, or another
  // Member's delete — so the Start stands in until the Author picks again.
  const selectedStep = Object.hasOwn(document.steps, selectedStepId)
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
          <p role="status" className="text-muted-foreground text-sm">
            {STATUS_TEXT[status]}
          </p>
          <Button variant="outline" onClick={addNewStep}>
            Add step
          </Button>
          <Button
            variant="outline"
            disabled={validating}
            onClick={() => void validate()}
          >
            Validate
          </Button>
        </div>
      </div>

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

      {problems !== null || validateError !== null ? (
        <section
          aria-label="Validation"
          className="flex flex-col gap-2 rounded-xl px-4 py-3 ring-1 ring-foreground/10"
        >
          <h3 className="text-sm font-medium">Validation</h3>

          {validateError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {validateError}
            </p>
          ) : null}

          {problems !== null && problems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No problems found.</p>
          ) : null}

          {problems !== null && problems.length > 0 ? (
            // role="list" is explicit for consistency with the app's other
            // lists. One rule can name the same Step more than once (one
            // entry per dangling Choice), so the Choice id is part of the key.
            <ul
              role="list"
              aria-label="Validation problems"
              className="flex list-disc flex-col gap-1 pl-5 text-sm"
            >
              {problems.map((problem, index) => {
                const { stepId } = problem;
                return (
                  <li
                    key={`${problem.code}-${stepId ?? ""}-${problem.choiceId ?? index}`}
                  >
                    {stepId !== undefined ? (
                      <button
                        type="button"
                        className="text-left underline underline-offset-4"
                        onClick={() => setSelectedStepId(stepId)}
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
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <OutcomeList document={document} onChange={applyEdit} />
          <StepList
            document={document}
            selectedStepId={selectedStep?.id ?? ""}
            onSelectStep={selectStep}
          />
        </div>

        {selectedStep ? (
          <StepPanel
            document={document}
            step={selectedStep}
            revision={revision}
            focusTitle={titleFocusStepId === selectedStep.id}
            onChange={applyEdit}
            onSelectStep={selectStep}
            onContentChange={handleContentChange}
            onContentRefused={(message) =>
              setContentNotice({ stepId: selectedStep.id, message })
            }
            onDeleteStep={removeStep}
          />
        ) : null}
      </div>
    </div>
  );
}
