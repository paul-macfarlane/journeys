"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent } from "react";

import {
  saveDraftAction,
  type SaveDraftActionResult,
} from "@/app/projects/[projectId]/journeys/actions";
import {
  counted,
  type ApplyEdit,
  type SelectStep,
} from "@/components/journeys/editor-shared";
import { FindStep } from "@/components/journeys/find-step";
import {
  JourneyCanvas,
  type CanvasArrow,
} from "@/components/journeys/journey-canvas";
import { StepPanel } from "@/components/journeys/step-panel";
import {
  PANEL_STORAGE_KEY,
  readPreference,
  writePreference,
} from "@/lib/browser-preferences";
import type { Content } from "@/lib/graph/content";
import {
  documentsEqual,
  type GraphDocument,
  type LayoutDirection,
} from "@/lib/graph/document";
import {
  addChoice,
  addChoiceToNewStep,
  addStep,
  deleteStep,
  duplicateStep,
  removeChoice,
  setLayoutDirection,
  setStart,
  updateChoice,
  updateStep,
} from "@/lib/graph/edit";
import {
  canRedo,
  canUndo,
  emptyHistory,
  recordEdit,
  redo as redoHistory,
  undo as undoHistory,
  type History,
  type HistoryMove,
} from "@/lib/graph/history";
import { layoutGraph, mapOrder, problemsByAddress } from "@/lib/graph/layout";
import { validateForPublish, type PublishProblem } from "@/lib/graph/validate";
import { cn } from "@/lib/utils";

/**
 * The Draft editor: the map of the Journey beside a panel on the Step the
 * Author has open, with "Find step" above the map. Everything an Author
 * changes happens in the document this component holds; the server hears
 * about it through one autosave.
 *
 * Why the whole document rather than per-field actions: a Draft is one jsonb
 * row (see `docs/adr/0001-graph-as-one-json-document.md`), so the only write
 * there is to make is "store this document". Last write wins, as the spec
 * says: a Member who saves later overwrites what an earlier one stored.
 */

/** Long enough that a sentence is one save, short enough to feel immediate. */
const SAVE_DEBOUNCE_MS = 600;

/**
 * The widths at which the Step panel is beside the map: Tailwind's `lg`
 * (64rem), the very query the editor's grid below goes to two columns on.
 * Read as that query and not its complement so an engine that cannot read
 * the range syntax answers the same way for both: no side-by-side grid, so
 * a stacked panel, so the scroll.
 */
const SIDE_BY_SIDE_QUERY = "(width >= 64rem)";

/**
 * Whether anything on the page has the keyboard to itself. Both of the page's
 * shortcuts ask before they claim a press: while a dialog is open the
 * keyboard belongs to the dialog, and a shortcut answering from behind it
 * would act on something the Author cannot see.
 *
 * `window.document`: the Draft is what `document` names inside this module.
 */
function dialogIsOpen(): boolean {
  return (
    window.document.querySelector('[role="dialog"], [role="alertdialog"]') !==
    null
  );
}

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
  /**
   * The Draft's one undo and redo, over the whole document: what the two
   * buttons on the map read to know whether they have anything to do, and
   * what the keyboard reaches from anywhere on the page. Held in state for
   * them and in a ref for everything that reads it from a handler.
   *
   * `window.history`: the Draft's is what `history` names inside this
   * component, as `document` is the Draft.
   */
  const [history, setHistory] = useState<History>(emptyHistory);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
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
  // Counts the times the Draft was replaced from outside this editor, so the
  // rich text surface can be re-fed even when the selected Step is the same.
  const [revision, setRevision] = useState(0);
  /**
   * Counts the times Cmd/Ctrl+K asked for the "Find step" field, so a second
   * press puts the Author back in it with what they typed selected.
   */
  const [findFocusRequest, setFindFocusRequest] = useState(0);

  /**
   * Whether the panel is beside the map. Shown on the first render whatever
   * the browser remembers, so the server's render and the hydrating one agree
   * — what it remembers is read a moment later, on mount.
   */
  const [panelShown, setPanelShown] = useState(true);
  const panelShownRef = useRef(true);
  /**
   * Counts the times the Author put the panel away or brought it back, which
   * is the one change of the map's width they asked for. The map fits itself
   * to each width the sliding columns hand it, so the last fit lands on the
   * width it keeps; what is counted here is only that a change has begun. A
   * panel that comes back because a Step was opened is not counted: that
   * opening makes its own move to the Step, and the whole map is not what it
   * asked for.
   */
  const [fitRequest, setFitRequest] = useState(0);

  // The save loop reads these rather than state: it runs from a timer and
  // from an event handler, both of which would otherwise see whatever render
  // they were created in.
  const documentRef = useRef(draft);
  const historyRef = useRef<History>(emptyHistory());
  /**
   * The Step an edit belongs to when it does not say — every edit made in the
   * panel — and the Step a redo puts back. Kept beside the state rather than
   * read off it, because an edit and a shortcut are both handlers.
   */
  const selectedStepIdRef = useRef(draft.startStepId);
  const lastSavedRef = useRef(draft);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /**
   * `selectStep` is declared below `save`, which opens a Step when a write is
   * refused over that Step; this is how the earlier of the two reaches the
   * later without either depending on the other's identity.
   */
  const selectStepRef = useRef<SelectStep>(() => {});

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
          // A refusal that names a Step is about that Step, so it is opened
          // the way every other opening opens one — the panel comes back for
          // it if it was away, and the map goes to its box.
          if (
            result.stepId !== undefined &&
            Object.hasOwn(documentRef.current.steps, result.stepId)
          ) {
            selectStepRef.current(result.stepId);
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

  /**
   * The document becoming another one, written the way every change to it is:
   * held here, shown, and saved a moment later. An edit takes this path with
   * a note of what it was for the history; an undo and a redo take it with
   * nothing recorded, because they are the history moving rather than
   * something to be taken back in turn.
   */
  const applyDocument = useCallback(
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
   * Every change an Author makes to the Draft comes through here: recorded on
   * the history, then applied. What the edit was — the Step it belongs to,
   * the field it was typed into — is what an undo of it puts back and what
   * decides whether it joins the keystroke before it.
   */
  const applyEdit = useCallback<ApplyEdit>(
    (next, edit) => {
      // A move that hands back the document it was given changed nothing —
      // a title set to what it already said, a Choice dropped where it
      // already pointed. There is nothing to undo and nothing to write.
      if (next === documentRef.current) return;

      const nextHistory = recordEdit(
        historyRef.current,
        {
          document: documentRef.current,
          selectedStepId: edit?.stepId ?? selectedStepIdRef.current,
        },
        { field: edit?.field ?? null, at: Date.now() },
      );
      historyRef.current = nextHistory;
      setHistory(nextHistory);

      applyDocument(next);
    },
    [applyDocument],
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

    const kept = Object.hasOwn(draft.steps, selectedStepIdRef.current)
      ? selectedStepIdRef.current
      : draft.startStepId;
    selectedStepIdRef.current = kept;
    setSelectedStepId(kept);

    // The history goes with the document it was a history of: every snapshot
    // on it is a state of a Draft this editor is no longer holding, and an
    // undo back into one of them would throw away the write that arrived.
    historyRef.current = emptyHistory();
    setHistory(historyRef.current);
  }, [draft]);

  // Unmounting with an edit still unsaved — the Author opened the Versions
  // tab inside the debounce window — is the timer's save made now, through
  // the same path: a save already running is asked to go round once more,
  // and the refresh at the end is what hands the next mount of this editor
  // the document as saved rather than the one the page was opened with.
  useEffect(
    () => () => {
      clearTimer();
      void save();
    },
    [clearTimer, save],
  );

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
    [applyEdit],
  );

  // The Step whose title field should take focus when it opens: one that was
  // just created and has only "Untitled step" for a name.
  const [titleFocusStepId, setTitleFocusStepId] = useState<string | null>(null);

  /**
   * The arrow the Author has last clicked on the map, as asked for. Held here
   * rather than in React Flow so that the arrows the canvas draws are derived
   * from the document and this, and there is never a second account of what
   * is selected to disagree with.
   */
  const [arrowSelection, setArrowSelection] = useState<CanvasArrow | null>(
    null,
  );

  /**
   * What the map is asked for each time a Step is opened: `request` counts
   * the openings, the one already open included, so the map answers each one
   * rather than only the ones that changed which Step is open, and `view` is
   * what it is asked for — `keep` to move nothing, `reveal` to bring the box
   * onto the map only when it is off it, and `zoom` to make the Zoom-to-step
   * move on it whatever it was doing.
   */
  const [locate, setLocate] = useState<{
    request: number;
    view: "keep" | "reveal" | "zoom";
  }>({ request: 0, view: "reveal" });

  /**
   * The panel put away or brought back, and whether that moved it: `remember`
   * says whether this is the Author choosing how to read the map — "Hide
   * panel", "Show panel", Escape — which is what the browser keeps; the panel
   * coming back because a Step was opened is the editing gesture doing its
   * job, and leaves the choice the Author made standing for the next page.
   * Nothing is said when the panel is already where it is asked to be:
   * opening a Step asks for it every time.
   */
  const applyPanelShown = useCallback(
    (shown: boolean, { remember }: { remember: boolean }): boolean => {
      if (panelShownRef.current === shown) return false;
      panelShownRef.current = shown;
      setPanelShown(shown);
      if (!remember) return true;

      // Reading the map with the panel out of the way is how one Author is
      // looking at the Journey right now, not something about the Journey:
      // the browser keeps it, never the document, where it would follow
      // every other Member around.
      writePreference(PANEL_STORAGE_KEY, shown ? "shown" : "hidden");
      return true;
    },
    [],
  );

  /**
   * The Author putting the panel away, and asking for it back: the one move
   * of the panel the map fits itself again for, because the width they gave
   * it or took back is the frame they mean to read the whole map in. A panel
   * that comes back for an opened Step is not this: the frame narrows,
   * nothing re-fits, and the opening makes its own move to the Step.
   */
  const setPanelByAuthor = useCallback(
    (shown: boolean) => {
      if (!applyPanelShown(shown, { remember: true })) return;
      setFitRequest((current) => current + 1);
    },
    [applyPanelShown],
  );
  const hidePanel = useCallback(
    () => setPanelByAuthor(false),
    [setPanelByAuthor],
  );
  const showPanel = useCallback(
    () => setPanelByAuthor(true),
    [setPanelByAuthor],
  );
  /** The panel brought back by an opening rather than asked for. */
  const revealPanel = useCallback(
    () => applyPanelShown(true, { remember: false }),
    [applyPanelShown],
  );

  // What this browser last chose, read once the page is the browser's: the
  // server cannot know it, and a first render that assumed it would not be
  // the render the server sent. Nothing is written back — this is what is
  // already stored.
  useEffect(() => {
    if (readPreference(PANEL_STORAGE_KEY) === "hidden") {
      applyPanelShown(false, { remember: false });
    }
  }, [applyPanelShown]);

  /**
   * The panel's column, and a count of the openings that asked for it to be
   * scrolled to. An opening from a click on the map asks; the effect below
   * answers once the panel is rendered, and only where the panel is stacked
   * under the map.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelScrollRequest, setPanelScrollRequest] = useState(0);

  const selectStep: SelectStep = useCallback(
    (stepId, options) => {
      if (options?.scrollToPanel) {
        setPanelScrollRequest((current) => current + 1);
      }
      // Opening a Step is asking to edit it, from wherever the Author asked:
      // a box, an arrow, a problem, "Open" on a Choice, "Find step",
      // any of the moves that make a Step, or a save the server refused over
      // that Step. The panel comes back for all of them, so the editing
      // gesture never changes for the panel being away — for this page only,
      // because it is the opening asking and not the Author.
      //
      // Whether the panel was away is read before it is brought back: an
      // opening from a map that had the whole width is one whose frame is
      // about to narrow, so the map goes to the Step rather than leaving it
      // wherever the narrower frame puts it.
      const panelWasHidden = !panelShownRef.current;
      revealPanel();
      selectedStepIdRef.current = stepId;
      setSelectedStepId(stepId);
      setLocate((current) => ({
        request: current.request + 1,
        view: options?.keepView
          ? "keep"
          : options?.zoom === true || (panelWasHidden && !options?.reveal)
            ? "zoom"
            : "reveal",
      }));
      setTitleFocusStepId(options?.focusTitle ? stepId : null);

      // The Choice in hand is one thing, not two: the arrow drawn heaviest
      // on the map and the row marked in the panel are the same Choice, so
      // an opening that names one is the arrow being taken hold of, and an
      // opening that names none is the Author's attention leaving it.
      const markChoiceId = options?.markChoiceId;
      setArrowSelection(
        markChoiceId === undefined ? null : { stepId, choiceId: markChoiceId },
      );
    },
    [revealPanel],
  );

  // The one place the ref above is kept current, so `save` opens a Step
  // through exactly the function this render would.
  useEffect(() => {
    selectStepRef.current = selectStep;
  }, [selectStep]);

  // Where the panel is stacked under the map — the page narrower than the
  // `lg` breakpoint the editor's grid puts the two side by side from — a
  // click on the map is followed by the page scrolling the panel's top into
  // view, under the sticky rows: the map is at least 36rem tall, so the
  // panel starts below the fold and nothing else brings it on. The panel is
  // rendered by the time this runs, brought back for the opening if it was
  // away. Read as a media query, the same one the grid answers to, never as
  // a width. `scroll-padding-top` on the page (`globals.css`) is what keeps
  // the panel's top from landing under the navbar and the tab row.
  useEffect(() => {
    if (panelScrollRequest === 0) return;
    if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
    panelRef.current?.scrollIntoView({ block: "start" });
  }, [panelScrollRequest]);

  /**
   * A move taken off the history put into effect. The document is set through
   * the ordinary path, so an undo autosaves like the edit it takes back; the
   * rich text surface is re-fed when the move replaced what is under the open
   * Step's surface, and left alone — caret and all — when the move was about
   * something else; and the Step the move belongs to is opened with nothing
   * asked of the map beyond bringing its box on if it is off it.
   */
  const applyMove = useCallback(
    (move: HistoryMove | null) => {
      if (move === null) return;

      // A Step the restored document does not have — the edit belonged to a
      // Step a later move deleted — leaves the Start to stand in, the way
      // every other selection that outlives its Step does.
      const restored = move.snapshot;
      const stepId = Object.hasOwn(
        restored.document.steps,
        restored.selectedStepId,
      )
        ? restored.selectedStepId
        : restored.document.startStepId;
      // Read before the document moves: the content is one immutable value
      // per edit, so a different reference is a different reading.
      const contentReplaced =
        restored.document.steps[stepId].content !==
        documentRef.current.steps[stepId]?.content;

      historyRef.current = move.history;
      setHistory(move.history);
      applyDocument(restored.document);
      if (contentReplaced) setRevision((current) => current + 1);
      selectStep(stepId, { reveal: true });
    },
    [applyDocument, selectStep],
  );

  /** Where an undo or a redo is taken back from, and taken back to. */
  const currentSnapshot = useCallback(
    () => ({
      document: documentRef.current,
      selectedStepId: selectedStepIdRef.current,
    }),
    [],
  );

  const undoEdit = useCallback(() => {
    applyMove(
      undoHistory(historyRef.current, currentSnapshot(), { at: Date.now() }),
    );
  }, [applyMove, currentSnapshot]);

  const redoEdit = useCallback(() => {
    applyMove(
      redoHistory(historyRef.current, currentSnapshot(), { at: Date.now() }),
    );
  }, [applyMove, currentSnapshot]);

  // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z — Ctrl+Y as well, for hands used to it —
  // from anywhere on the Journey page, the Cmd/Ctrl+K listener above being
  // the model for all of it: on `window`, because the point is not having to
  // reach for the buttons; and a press made while a dialog is open belongs to
  // the dialog. A press carrying Alt is a different shortcut and not this one.
  //
  // The default is prevented for every press this claims, an empty stack
  // included: the browser's own undo would otherwise replay old values into
  // whatever field the Author happens to be in, which is the thing this
  // ticket exists to stop. There is one undo on this page, and it is this.
  //
  // Which is why this one listens on the way down rather than on the way up,
  // where "Find step" listens. ProseMirror answers Mod-B, Mod-I, Mod-Y and
  // Mod-Z on its surface whatever extensions it was given — `captureKeyDown`
  // swallows them so the browser cannot rewrite the document behind its back
  // — so a press made while the Author is writing a Step's reading would
  // arrive here already answered and this would stand aside from the one
  // undo the page has. Claiming it first is what makes the surface's undo
  // the Draft's, as the ticket asks. Nothing else on the page answers these
  // keys, so there is nothing here to take a press away from — and, being
  // first, nothing has had the chance to answer one before this reads it.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (dialogIsOpen()) return;

      // Shift+Z arrives as "Z": the key is read in one case.
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redoEdit();
        else undoEdit();
        return;
      }
      // Ctrl+Y only: Cmd+Y is the system's on an Apple platform.
      if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        redoEdit();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [redoEdit, undoEdit]);

  /**
   * A selected arrow can outlive the Choice it draws — deleted here, or by
   * another Member's write — so what the map is handed is the selection only
   * while the document still has it, the way `selectedStep` is below.
   */
  const selectedArrow = useMemo(() => {
    if (arrowSelection === null) return null;

    const step = Object.hasOwn(document.steps, arrowSelection.stepId)
      ? document.steps[arrowSelection.stepId]
      : null;
    const alive =
      step?.choices.some((choice) => choice.id === arrowSelection.choiceId) ??
      false;
    return alive ? arrowSelection : null;
  }, [document, arrowSelection]);

  /** The Delete key on a selected arrow, which is the panel's "Remove choice". */
  const removeChoices = useCallback(
    (arrows: CanvasArrow[]) => {
      let next = documentRef.current;
      for (const arrow of arrows) {
        next = removeChoice(next, arrow.stepId, arrow.choiceId);
      }
      if (next === documentRef.current) return;

      // The Step the first arrow left: where an undo of this puts the Author
      // back, whatever the map had selected by then.
      applyEdit(next, { stepId: arrows[0].stepId });
    },
    [applyEdit],
  );

  /** "Add step": the new Step opened, with the map zoomed to where it landed. */
  const addNewStep = useCallback(() => {
    const created = addStep(documentRef.current);
    applyEdit(created.document);
    selectStep(created.stepId, { focusTitle: true, zoom: true });
  }, [applyEdit, selectStep]);

  /**
   * "Add next step" on a box's toolbar: the Step and the Choice that reaches
   * it in one motion, opened with its title field focused so the Author names
   * it in the same breath, and the map zoomed to the box it landed on. The
   * label is left empty — what the Choice is called is the next thing to
   * write, on the Step it leaves.
   */
  const addNextStep = useCallback(
    (stepId: string) => {
      const created = addChoiceToNewStep(documentRef.current, stepId, {
        label: "",
      });
      if (created.choiceId === "") return;

      applyEdit(created.document, { stepId });
      selectStep(created.stepId, { focusTitle: true, zoom: true });
    },
    [applyEdit, selectStep],
  );

  /**
   * "Duplicate" on a box's toolbar or the panel footer: a copy of the Step
   * with no Choices, opened with its title field focused so the Author can
   * rename it right away — the same opening "Add next step" gives a new one.
   */
  const duplicate = useCallback(
    (stepId: string) => {
      const created = duplicateStep(documentRef.current, stepId);
      if (created.stepId === "") return;

      applyEdit(created.document, { stepId });
      selectStep(created.stepId, { focusTitle: true, zoom: true });
    },
    [applyEdit, selectStep],
  );

  const makeStart = useCallback(
    (stepId: string) => {
      applyEdit(setStart(documentRef.current, stepId), { stepId });
    },
    [applyEdit],
  );

  /**
   * Which way the map runs, asked for from the control on the canvas. A
   * property of the Journey rather than of the browser looking at it, so it
   * takes the same path as every other edit: into the document, out through
   * the one autosave, and on to the next Member who opens the Draft.
   */
  const setDirection = useCallback(
    (direction: LayoutDirection) => {
      applyEdit(setLayoutDirection(documentRef.current, direction));
    },
    [applyEdit],
  );

  /**
   * An arrow drawn from one box onto another: the Choice exists the moment
   * the Author lets go, and the panel opens on the Step it leaves with the
   * new row marked — the drag said where the Choice goes, not what it says,
   * and the Author's hands are still on the map.
   */
  const connectSteps = useCallback(
    (stepId: string, targetStepId: string) => {
      const created = addChoice(documentRef.current, stepId, {
        label: "",
        targetStepId,
      });
      if (created.choiceId === "") return;

      applyEdit(created.document, { stepId });
      selectStep(stepId, { markChoiceId: created.choiceId });
    },
    [applyEdit, selectStep],
  );

  /**
   * An arrow drawn from a box onto bare map: there is no Step there to lead
   * to, so one is made and the Choice with it, in the one motion — opened
   * with its title field focused and the map zoomed to where it landed,
   * exactly as "Add next step" opens the Step it makes. What the Choice is
   * called is the next thing to write, on the Step it leaves.
   */
  const connectToNewStep = useCallback(
    (stepId: string) => {
      const created = addChoiceToNewStep(documentRef.current, stepId, {
        label: "",
      });
      if (created.choiceId === "") return;

      applyEdit(created.document, { stepId });
      selectStep(created.stepId, { focusTitle: true, zoom: true });
    },
    [applyEdit, selectStep],
  );

  /** The head of an arrow dropped on another box. */
  const retargetChoice = useCallback(
    (stepId: string, choiceId: string, targetStepId: string) => {
      applyEdit(
        updateChoice(documentRef.current, stepId, choiceId, { targetStepId }),
        { stepId },
      );
    },
    [applyEdit],
  );

  const removeStep = useCallback(
    (stepId: string) => {
      const result = deleteStep(documentRef.current, stepId);
      if (!result.ok) return;

      // The Step that goes: an undo brings it back, and brings the Author
      // back to it.
      applyEdit(result.document, { stepId });
      // The arrow in hand is let go of and no Choice's label is asked for,
      // and the view is left exactly as it was: a Step going is not somewhere
      // the Author asked to be taken.
      selectStep(result.document.startStepId, { keepView: true });
    },
    [applyEdit, selectStep],
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

  // The same problems, addressed by Step and by Choice, so the panel can show
  // each one where it belongs rather than only in the flat list above.
  const liveProblemAddresses = useMemo(
    () => problemsByAddress(liveProblems),
    [liveProblems],
  );

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

  const selectedStepProblems = useMemo(
    () =>
      selectedStep !== null
        ? (liveProblemAddresses.steps.get(selectedStep.id) ?? [])
        : [],
    [liveProblemAddresses, selectedStep],
  );

  // The open Step's own Choice problems, stripped of the "<stepId>:" prefix
  // `problemsByAddress` files them under, so the panel can key straight off
  // the Choice id.
  const selectedStepChoiceProblems = useMemo(() => {
    const byChoice = new Map<string, PublishProblem[]>();
    if (selectedStep === null) return byChoice;

    const prefix = `${selectedStep.id}:`;
    for (const [key, choiceProblems] of liveProblemAddresses.choices) {
      if (key.startsWith(prefix)) {
        byChoice.set(key.slice(prefix.length), choiceProblems);
      }
    }
    return byChoice;
  }, [liveProblemAddresses, selectedStep]);

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
          selectedStepId={selectedStep?.id ?? ""}
          locate={locate}
          problems={liveProblems}
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
          onSelectStep={selectStep}
          onAddStep={addNewStep}
          canUndo={canUndo(history)}
          canRedo={canRedo(history)}
          onUndo={undoEdit}
          onRedo={redoEdit}
          onSetLayoutDirection={setDirection}
          panelShown={panelShown}
          fitRequest={fitRequest}
          onShowPanel={showPanel}
          onHidePanel={hidePanel}
          onAddNextStep={addNextStep}
          onDuplicateStep={duplicate}
          onSetStart={makeStart}
          onDeleteStep={removeStep}
          onConnectChoice={connectSteps}
          onConnectToNewStep={connectToNewStep}
          onRetargetChoice={retargetChoice}
          selectedArrow={selectedArrow}
          onSelectArrow={setArrowSelection}
          onRemoveChoices={removeChoices}
        />

        {/* Nothing of a panel that is away is left behind to be tabbed into
            or read out: the column closes over it and it is not rendered. */}
        <div ref={panelRef} className="min-w-0 overflow-hidden">
          {selectedStep && panelShown ? (
            <StepPanel
              document={document}
              step={selectedStep}
              order={stepOrder}
              problems={selectedStepProblems}
              choiceProblems={selectedStepChoiceProblems}
              revision={revision}
              focusTitle={titleFocusStepId === selectedStep.id}
              markedChoiceId={
                selectedArrow?.stepId === selectedStep.id
                  ? selectedArrow.choiceId
                  : null
              }
              onChange={applyEdit}
              onSelectStep={selectStep}
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
