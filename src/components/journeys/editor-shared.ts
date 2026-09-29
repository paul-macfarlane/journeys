import type { GraphDocument } from "@/lib/graph/document";

/**
 * The scraps every piece of the Draft editor needs: the count-and-noun
 * phrasing its summary lines use, how a Choice with no label yet is still
 * named, the shape of an edit on its way to the document, and the look of the
 * native `<select>`s it reaches for where the app has no shadcn primitive.
 */

/**
 * What an edit is about, for the one undo the editor keeps over the whole
 * document. Both parts are optional because most edits need neither.
 *
 * `stepId` is the Step the edit belongs to, which is the Step an undo of it
 * opens: the source Step for a Choice drawn, retargeted, or removed on the
 * map, the Step deleted, the Step a move on a box was made on. Left out, the
 * edit belongs to whichever Step is open — every edit made in the panel, and
 * the ones that belong to no Step at all, like "Add step" and which way the
 * map runs.
 *
 * `field` names the text field being typed into — `title:<stepId>`,
 * `content:<stepId>`, `choice-label:<choiceId>`, `outcome-label:<outcomeId>`
 * — so a run of keystrokes in one field is one thing to undo rather than one
 * per letter. An edit that is not typing names none.
 */
export type EditMeta = {
  stepId?: string;
  field?: string;
};

/**
 * The one way anything in the editor changes the document: hand back the
 * document it should become, and say what the edit was.
 */
export type ApplyEdit = (next: GraphDocument, edit?: EditMeta) => void;

/**
 * How a Step is opened in the panel. `focusTitle` is for a Step that was just
 * created from a Choice: it opens with its title field focused so the Author
 * names it in the same breath. `markChoiceId` names the Choice whose row is
 * marked as the one in hand — an arrow clicked, or a Choice just drawn — and
 * moves no focus at all: the Author is working on the map, and the panel says
 * which Choice that is rather than reaching for the keyboard. `focusChoice`
 * is the exception, for an arrow taken in hand from the keyboard (Enter or
 * Space on a focused arrow, ticket 88): that Author is already at the
 * keyboard, so it moves onto the marked row's label field instead of being
 * dropped on the page as the arrow is redrawn.
 *
 * The other two are about the map rather than the panel, and the view is the
 * Author's: `zoom` makes the Zoom-to-step move on the opened Step — for a
 * Step found by name, and for one just made, which is where the Author is now
 * working — and `keepView` moves nothing at all, for an opening that is the
 * aftermath of something else, like the Start opened when a Step is deleted.
 * Neither given, a box already on the map is left where it stands and one off
 * it is brought on — unless the panel was away, when the frame is about to
 * narrow and the opening zooms to the Step instead. `reveal` holds to the
 * first rule even then: an undo or a redo moves the view no further than
 * bringing the box on, whatever the panel was doing.
 */
export type SelectStepOptions = {
  focusTitle?: boolean;
  markChoiceId?: string;
  focusChoice?: boolean;
  zoom?: boolean;
  keepView?: boolean;
  reveal?: boolean;
  /**
   * The opening came from a click on the map — a box, an arrow — so where
   * the panel is stacked under the map, narrower than the `lg` breakpoint,
   * the page is scrolled to bring the panel's top under the sticky rows:
   * on a phone the map fills the screen and the panel starts below the
   * fold. Never set for the keyboard walking between boxes, which opens
   * nothing, nor for openings the panel itself makes.
   */
  scrollToPanel?: boolean;
};

export type SelectStep = (stepId: string, options?: SelectStepOptions) => void;

/**
 * An ask, from outside the panel, for the keyboard to go to one Choice's
 * label field: a new object for every ask, so asking twice for the same
 * Choice is still two asks.
 */
export type ChoiceFocus = { choiceId: string };

/** One Choice, named the way the document names it. */
export type CanvasArrow = { stepId: string; choiceId: string };

/**
 * What the map asks of the editor that is not an edit to the document: a
 * Step opened (a box or an arrow clicked), the arrow in hand taken hold of or
 * let go of, the panel put away or brought back, and the Draft's one undo and
 * redo. Edits travel as `EditCommand`s (`@/lib/graph/edit`) instead.
 */
export type SelectCommand =
  | { kind: "step"; stepId: string; options?: SelectStepOptions }
  | { kind: "arrow"; arrow: CanvasArrow | null }
  | { kind: "show-panel" }
  | { kind: "hide-panel" }
  | { kind: "undo" }
  | { kind: "redo" };

/**
 * The Step the panel's last "Add choice" made with "New step", offered for
 * editing under the Choices until the Author moves on. `announcement` counts
 * the adds, so a second add that reads the same ("Added "Untitled step"")
 * is still a change the live region announces.
 */
export type AddedStep = { stepId: string; announcement: number };

/** "1 step", "44 steps": the count and the noun that agrees with it. */
export function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * A Choice's label as an Author reads it: one with nothing written on it yet
 * still has to be readable, on the map, in the panel, and in the confirmation
 * that names the Choices a delete would break.
 */
export function choiceLabel(label: string): string {
  return label.trim().length > 0 ? label : "Untitled choice";
}

/**
 * A native select in `Input`'s box: the same height, radius, border, spacing,
 * and type size, so a select and an input in one row line up.
 */
export const SELECT_CLASS =
  "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

/**
 * Whether anything on the page has the keyboard to itself. The editor's
 * shortcuts and the map's delete keys ask before they claim a press: while a
 * dialog is open the keyboard belongs to the dialog, and a key answering from
 * behind it would act on something the Author cannot see.
 *
 * `window.document`: the Draft is what `document` names in the modules that
 * ask this.
 *
 * The Step panel as a bottom sheet on a phone (ticket 53) is a dialog too,
 * marked `data-step-sheet`, and it counts like any other unless the asker
 * says `ignoreStepSheet`: undo and redo do, because an edit made in the
 * sheet is one to undo in place; "Find step" and the map's delete keys do
 * not, because what they act on is behind the sheet. A dialog opened over
 * the sheet — a delete confirmation — still counts for everyone.
 */
export function dialogIsOpen({
  ignoreStepSheet = false,
}: { ignoreStepSheet?: boolean } = {}): boolean {
  const open = window.document.querySelectorAll(
    '[role="dialog"], [role="alertdialog"]',
  );
  return Array.from(open).some(
    (dialog) =>
      !ignoreStepSheet || dialog.closest("[data-step-sheet]") === null,
  );
}
