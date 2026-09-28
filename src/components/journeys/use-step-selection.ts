"use client";

import { useCallback, useRef, useState, type RefObject } from "react";

import type {
  AddedStep,
  CanvasArrow,
  SelectStep,
} from "@/components/journeys/editor-shared";
import { hasStep, type GraphDocument } from "@/lib/graph/document";

/**
 * Which Step the Draft editor has open, and everything an opening asks for
 * alongside it: the box the map selects, the Step "Add choice" just made,
 * the title field to focus, the arrow in hand, and what the map is asked to
 * do with its view (`locate`). `selectStep` is the one way a Step is opened.
 */
export function useStepSelection({
  startStepId,
  revealPanel,
  requestPanelScroll,
}: {
  /** The Start of the Draft the editor opened on, open to begin with. */
  startStepId: string;
  /** From `usePanelVisibility`: true when the panel was away. */
  revealPanel: () => boolean;
  requestPanelScroll: () => void;
}): {
  selectedStepId: string;
  /** The same, for handlers; see its declaration. */
  selectedStepIdRef: RefObject<string>;
  selectStep: SelectStep;
  mapOnlyStepId: string | null;
  added: AddedStep | null;
  choiceAdded: (stepId: string | null) => void;
  titleFocusStepId: string | null;
  arrowSelection: CanvasArrow | null;
  selectArrow: (arrow: CanvasArrow | null) => void;
  locate: { request: number; view: "keep" | "reveal" | "zoom" };
  /** A Draft adopted from outside: see `adoptDraft` below. */
  adoptDraft: (draft: GraphDocument) => void;
} {
  const [selectedStepId, setSelectedStepId] = useState(startStepId);
  /**
   * The Step an edit belongs to when it does not say — every edit made in the
   * panel — and the Step a redo puts back. Kept beside the state rather than
   * read off it, because an edit and a shortcut are both handlers.
   */
  const selectedStepIdRef = useRef(startStepId);

  /**
   * The box selected on the map while it is not the Step open in the panel,
   * or `null` while the two are one — which is almost always: opening a Step
   * selects its box. They are split for one move only (ticket 79): "Add
   * choice" to a New step from the panel keeps the panel on the Step the
   * Choice was written on, so a second "Add choice" lands there too, while
   * the Step just made is the box the map selects and brings on. Every
   * opening (`selectStep`) puts them back together, and so does adopting a
   * Draft from outside.
   */
  const [mapOnlyStepId, setMapOnlyStepId] = useState<string | null>(null);

  /**
   * The Step that same move made, which the panel names under its Choices
   * ("Added …", with a button to open it). Held beside `mapOnlyStepId` and
   * let go of with it: every opening — an undo and a redo open a Step too —
   * and every adopted Draft, so the line never names a Step the Author has
   * moved on from, taken back, or lost to another Member's write.
   */
  const [added, setAdded] = useState<AddedStep | null>(null);

  // The Step whose title field should take focus when it opens: one that was
  // just created, its title still empty (the map calls it "Untitled step").
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

  const selectStep: SelectStep = useCallback(
    (stepId, options) => {
      if (options?.scrollToPanel) {
        requestPanelScroll();
      }
      // Opening a Step is asking to edit it, from wherever the Author asked:
      // a box, an arrow, a problem, "Open" on a Choice, "Find step",
      // any of the moves that make a Step, or a save the server refused over
      // that Step. The panel comes back for all of them, so the editing
      // gesture never changes for the panel being away — for this page only,
      // because it is the opening asking and not the Author.
      //
      // Whether the panel was away is what bringing it back reports: an
      // opening from a map that had the whole width is one whose frame is
      // about to narrow, so the map goes to the Step rather than leaving it
      // wherever the narrower frame puts it.
      const panelWasHidden = revealPanel();
      selectedStepIdRef.current = stepId;
      setSelectedStepId(stepId);
      setMapOnlyStepId(null);
      setAdded(null);
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
    [requestPanelScroll, revealPanel],
  );

  /**
   * The panel's "Add choice" landed. To a New step: that Step's box selected
   * on the map, and brought onto it if it is off it, with the panel left on
   * the Step it has open (see `mapOnlyStepId`), and the Step named under the
   * Choices (see `added`). To a Step already there (`null`): nothing new to
   * name, so the line goes.
   */
  const choiceAdded = useCallback((stepId: string | null) => {
    if (stepId === null) {
      setAdded(null);
      return;
    }
    setMapOnlyStepId(stepId);
    setAdded((current) => ({
      stepId,
      announcement: (current?.announcement ?? 0) + 1,
    }));
    setArrowSelection(null);
    setLocate((current) => ({ request: current.request + 1, view: "reveal" }));
  }, []);

  /**
   * A Draft adopted from outside the editor: the Step open stays open if the
   * adopted Draft still has it, and the Start stands in if not. The Step an
   * "Add choice" just made, and the box selected for it, were of the Draft
   * this editor held; the one adopted may not have them.
   */
  const adoptDraft = useCallback((draft: GraphDocument) => {
    const kept = hasStep(draft, selectedStepIdRef.current)
      ? selectedStepIdRef.current
      : draft.startStepId;
    selectedStepIdRef.current = kept;
    setSelectedStepId(kept);
    setMapOnlyStepId(null);
    setAdded(null);
  }, []);

  return {
    selectedStepId,
    selectedStepIdRef,
    selectStep,
    mapOnlyStepId,
    added,
    choiceAdded,
    titleFocusStepId,
    arrowSelection,
    selectArrow: setArrowSelection,
    locate,
    adoptDraft,
  };
}
