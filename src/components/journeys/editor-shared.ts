/**
 * The two scraps every piece of the Draft editor needs: the count-and-noun
 * phrasing its summary lines use, and the look of the native `<select>`s it
 * reaches for where the app has no shadcn primitive.
 */

/**
 * How a Step is opened in the panel. `focusTitle` is for a Step that was just
 * created from a Choice: it opens with its title field focused so the Author
 * names it in the same breath.
 */
export type SelectStepOptions = { focusTitle?: boolean };

export type SelectStep = (stepId: string, options?: SelectStepOptions) => void;

/** "1 step", "44 steps": the count and the noun that agrees with it. */
export function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * A native select in `Input`'s box: the same height, radius, border, spacing,
 * and type size, so a select and an input in one row line up.
 */
export const SELECT_CLASS =
  "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";
