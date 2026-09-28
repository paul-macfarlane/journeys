"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { saveDraftAction } from "@/app/projects/[projectId]/journeys/actions";
import { useAutosave } from "@/components/autosave";
import { useRegisterDraft } from "@/components/journeys/draft-version";
import {
  dialogIsOpen,
  type ApplyEdit,
  type SelectStep,
} from "@/components/journeys/editor-shared";
import type { SaveStatus } from "@/lib/autosave";
import {
  documentsEqual,
  hasStep,
  type GraphDocument,
} from "@/lib/graph/document";
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

/**
 * The Draft the editor holds (`draft-editor.tsx`): the document, its one undo
 * and redo over the whole document (buttons and Cmd/Ctrl+Z alike), the one
 * autosave that writes it, and the adopting of a newer Draft written from
 * outside the editor. Which Step is open is `useStepSelection`'s; this hook
 * reads it (`selectedStepIdRef`) for what an edit belongs to, and opens a
 * Step through it (`selectStep`) for an undo, a redo, and a refused save.
 */

/**
 * What the editor's autosave loop holds: the document, and the Draft
 * version it was read or last stored at, which the next save is guarded by.
 */
type HeldDraft = { document: GraphDocument; version: number };

export function useDraftDocument({
  projectId,
  journeyId,
  draft,
  version,
  selectedStepIdRef,
  selectStep,
  adoptSelection,
}: {
  projectId: string;
  journeyId: string;
  draft: GraphDocument;
  /** The Draft version `draft` was read at. */
  version: number;
  selectedStepIdRef: RefObject<string>;
  selectStep: SelectStep;
  /** The selection kept or reset for a Draft adopted from outside. */
  adoptSelection: (draft: GraphDocument) => void;
}): {
  document: GraphDocument;
  /** The document as the handlers see it; see its declaration. */
  documentRef: RefObject<GraphDocument>;
  /** Counts the Drafts replaced under the rich text surface; see below. */
  revision: number;
  status: SaveStatus;
  reload: () => void;
  saveError: string | null;
  flushSave: () => Promise<void>;
  applyEdit: ApplyEdit;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  const router = useRouter();
  const registerDraft = useRegisterDraft();

  const [document, setDocument] = useState<GraphDocument>(draft);
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
  const [saveError, setSaveError] = useState<string | null>(null);
  // Counts the times the Draft was replaced from outside this editor, so the
  // rich text surface can be re-fed even when the selected Step is the same.
  const [revision, setRevision] = useState(0);

  // The document as the handlers see it, rather than state: they run from
  // timers and events, both of which would otherwise see whatever render
  // they were created in. Always what the autosave loop last received.
  const documentRef = useRef(draft);
  const historyRef = useRef<History>(emptyHistory());

  /**
   * The one autosave loop (`useAutosave`): one save in flight at a time with
   * at most one waiting behind it, the timer's write made on unmount, and
   * the browser asked before the page goes while an edit is unsaved.
   */
  const { status, autosave, reload } = useAutosave<HeldDraft>({
    initial: { document: draft, version },
    // The version is the server's to move; two documents are the same save.
    equals: (a, b) => documentsEqual(a.document, b.document),
    write: async (value, baseline) => {
      const result = await saveDraftAction(
        projectId,
        journeyId,
        value.document,
        baseline.version,
      );
      if (!result.ok) {
        if (result.stale) return { kind: "stale" };
        return { kind: "refused", error: result.error, stepId: result.stepId };
      }
      setSaveError(null);
      return {
        kind: "saved",
        saved: { document: value.document, version: result.version },
      };
    },
    // Terminal: the notice replaces the status line, and the edit stays.
    onStale: () => setSaveError(null),
    // Only with nothing left to write: the refresh is what lets the Publish
    // button notice the Draft has moved, and a refresh landing mid-edit
    // would only be answered by another one.
    onSaved: () => router.refresh(),
    onRefused: (result) => {
      // Editing continues and the next edit retries; nothing the Author has
      // typed is thrown away because a write failed.
      setSaveError(result.error);
      // A refusal that names a Step is about that Step, so it is opened the
      // way every other opening opens one — the panel comes back for it if
      // it was away, and the map goes to its box.
      if (
        result.stepId !== undefined &&
        hasStep(documentRef.current, result.stepId)
      ) {
        selectStep(result.stepId);
      }
    },
  });

  /** Waits out a save already running, then writes whatever is still unsaved. */
  const flushSave = useCallback(() => autosave.flush(), [autosave]);

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
      autosave.change({ document: next, version: autosave.current().version });
    },
    [autosave],
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
    [applyDocument, selectedStepIdRef],
  );

  /**
   * A `draft` at a newer version than the editor holds is someone else's
   * write or a restore: with nothing unsaved, the editor adopts it. A `draft`
   * at the version and document the editor last stored is its own save
   * coming back around, and is ignored.
   */
  useEffect(() => {
    const held = autosave.lastSaved();
    // A render the server started before the latest save can arrive after
    // it: an older version is never adopted, or the next save would be
    // guarded by it and refused.
    if (version < held.version) return;
    const sameDocument = documentsEqual(draft, held.document);
    if (version === held.version && sameDocument) return;
    // While an edit is unsaved or a save is running — either leaves the loop
    // dirty — nothing is adopted: the editor keeps the version its edit was
    // made against, so if another Member saved in between, the save about
    // to happen is refused as stale rather than overwriting theirs.
    if (autosave.isDirty()) return;

    autosave.adopt({ document: draft, version });
    // Only the version moved (the same document stored again): nothing on
    // screen, and nothing on the history, changes.
    if (sameDocument) return;
    documentRef.current = draft;
    // Set from the mirror just written, the one the handlers read: the same
    // document, and the React compiler's lint follows state set from a ref
    // in an effect where it would refuse the prop directly.
    setDocument(documentRef.current);
    setRevision((current) => current + 1);

    // The Step open, and the Step an "Add choice" just made, were of the
    // Draft this editor held; the one adopted may not have them.
    adoptSelection(draft);

    // The history goes with the document it was a history of: every snapshot
    // on it is a state of a Draft this editor is no longer holding, and an
    // undo back into one of them would throw away the write that arrived.
    historyRef.current = emptyHistory();
    setHistory(historyRef.current);
  }, [adoptSelection, autosave, draft, version]);

  // The Journey page's Publish and Restore wait for this editor's save and
  // are sent with the version it leaves (see `DraftVersionScope`).
  useEffect(
    () =>
      registerDraft({
        flush: () => autosave.flush(),
        version: () => autosave.lastSaved().version,
      }),
    [autosave, registerDraft],
  );

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
      const stepId = hasStep(restored.document, restored.selectedStepId)
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
    [selectedStepIdRef],
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

  return {
    document,
    documentRef,
    revision,
    status,
    reload,
    saveError,
    flushSave,
    applyEdit,
    undo: undoEdit,
    redo: redoEdit,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
