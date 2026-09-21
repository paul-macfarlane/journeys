/**
 * The two scraps every piece of the Draft editor needs: the count-and-noun
 * phrasing its summary lines use, and the look of the native `<select>`s it
 * reaches for where the app has no shadcn primitive.
 */

/** "1 step", "44 steps": the count and the noun that agrees with it. */
export function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** A native select dressed as `Input`, so a row of fields lines up. */
export const SELECT_CLASS =
  "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";
