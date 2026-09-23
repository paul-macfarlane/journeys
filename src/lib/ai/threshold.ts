/**
 * The judge's confidence threshold (ticket 43), kept out of the network
 * module: `step-view.tsx` needs only this number to decide what to say about
 * a judge's pick, and importing it from `decide.ts` would pull the AI SDK
 * into a component that never calls the gateway. No imports of its own, so
 * nothing here can pull the gateway client in by accident.
 */

/** At or above this probability, the Run advances without asking. Tuned in Preview. */
export const DECISION_THRESHOLD = 0.5;
