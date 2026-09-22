/**
 * The scraps every piece of the Draft editor needs: the count-and-noun
 * phrasing its summary lines use, how a Choice with no label yet is still
 * named, and the look of the native `<select>`s it reaches for where the app
 * has no shadcn primitive.
 */

/**
 * How a Step is opened in the panel. `focusTitle` is for a Step that was just
 * created from a Choice: it opens with its title field focused so the Author
 * names it in the same breath. `markChoiceId` names the Choice whose row is
 * marked as the one in hand — an arrow clicked, or a Choice just drawn — and
 * moves no focus at all: the Author is working on the map, and the panel says
 * which Choice that is rather than reaching for the keyboard.
 *
 * The other two are about the map rather than the panel, and the view is the
 * Author's: `zoom` makes the Zoom-to-step move on the opened Step — for a
 * Step found by name, and for one just made, which is where the Author is now
 * working — and `keepView` moves nothing at all, for an opening that is the
 * aftermath of something else, like the Start opened when a Step is deleted.
 * Neither given, a box already on the map is left where it stands and one off
 * it is brought on.
 */
export type SelectStepOptions = {
  focusTitle?: boolean;
  markChoiceId?: string;
  zoom?: boolean;
  keepView?: boolean;
};

export type SelectStep = (stepId: string, options?: SelectStepOptions) => void;

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
