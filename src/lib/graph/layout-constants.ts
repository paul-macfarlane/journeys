/**
 * Constants shared across the layout modules (`layout.ts`, `layout-dagre.ts`,
 * `layout-routing.ts`, `layout-labels.ts`), pulled out on their own so none of
 * those modules has to import a value from another and risk an import cycle.
 * `layout.ts` re-exports every one of these, so `@/lib/graph/layout` still
 * carries every constant it always has.
 */

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 72;

/**
 * How wide a Choice's label is drawn on its arrow before it is cut short with
 * an ellipsis, in flow units. Sized to case-3's own Choices: its longest runs
 * to ninety characters, which no gap between boxes should have to hold, and
 * this width shows the opening five or six words of one — enough to tell the
 * Choices apart on the map, with the full text in the arrow's accessible name
 * and its title, and in the panel's row.
 */
export const EDGE_LABEL_MAX_WIDTH = 160;

/** How tall the label on an arrow is drawn, in flow units. */
export const EDGE_LABEL_HEIGHT = 24;

/**
 * The clearance between a rank of boxes and the labels hung between it and
 * the next. Every arrow's label is given to dagre as a box of its own
 * (`EDGE_LABEL_MAX_WIDTH` by `EDGE_LABEL_HEIGHT`), which dagre keeps in a
 * rank of its own halfway between the two ranks of boxes with half this
 * separation on either side of it — so the gap between two ranks of boxes is
 * this plus whichever side of the label lies along the arrow: its height top
 * to bottom, its width left to right. Two labels between the same two ranks
 * are kept apart along the cross axis the way any two boxes in a rank are,
 * which is what stops two Choices from one Step reading as one.
 */
export const TB_RANK_SEPARATION = 72;
export const LR_RANK_SEPARATION = 48;
