import type { ReactNode } from "react";

import { RichText } from "@/components/runner/rich-text";
import { buttonVariants } from "@/components/ui/button";
import { isEnding, type GraphDocument, type Step } from "@/lib/graph/document";
import { cn } from "@/lib/utils";

/**
 * One Step, rendered for whoever is walking the graph — Preview (ticket 05)
 * and the participant runner at `/j/{journey-id}` (ticket 06). This component
 * knows nothing about Preview, Runs, or Responses: the caller supplies every
 * URL and the whole "Start over" control, so the same component serves both.
 *
 * Every navigation here is a plain `<a>`, never `next/link`. A prefetched
 * Choice would reach the runner's step page and append a Step the Participant
 * never chose, and the browser's own back button has to reach the server for
 * the backtrack to be recorded at all. Preview inherits full-page navigation,
 * which changes nothing it proves.
 */

/**
 * A Choice: full width, wrapping, and tall enough to be a comfortable tap
 * target on a phone. Exported so the runner's own controls — "Begin", "Start
 * over", "Continue where you left off" — match the Choices they sit beside.
 */
export const choiceLinkClassName = cn(
  buttonVariants({ variant: "outline" }),
  "h-auto min-h-11 w-full justify-start py-3 text-left whitespace-normal",
);

function EndingView({
  step,
  document,
  startOver,
}: {
  step: Step;
  document: GraphDocument;
  startOver: ReactNode;
}) {
  // `Object.hasOwn`, not `in` or bare indexing: the maps are plain objects
  // parsed from JSON, so an id like "toString" would otherwise find a
  // prototype method and read as a real Outcome.
  const outcome =
    step.outcomeId !== null && Object.hasOwn(document.outcomes, step.outcomeId)
      ? document.outcomes[step.outcomeId]
      : null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">The end</h2>
      {/*
       * Only an Ending the Author grouped says what it was grouped by. An
       * Ending needs no Outcome, and nothing stands in for the one it does not
       * carry: what an Author has or has not tagged is authoring state, and a
       * Participant is not being shown it.
       */}
      {outcome === null ? null : <p>Outcome: {outcome.label}</p>}
      {startOver}
    </div>
  );
}

export function StepView({
  step,
  document,
  stepHref,
  startOver,
}: {
  step: Step;
  document: GraphDocument;
  stepHref: (stepId: string) => string;
  startOver: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
      <RichText content={step.content} />

      {isEnding(step) ? (
        <EndingView step={step} document={document} startOver={startOver} />
      ) : (
        // role="list" is explicit: the flex layout strips the list marker, and
        // some browsers drop the implicit role with it.
        <ul role="list" aria-label="Choices" className="flex flex-col gap-2">
          {step.choices.map((choice) => {
            // Own property only — see the Outcome lookup above.
            const targetExists = Object.hasOwn(
              document.steps,
              choice.targetStepId,
            );
            return (
              <li key={choice.id}>
                {targetExists ? (
                  <a
                    href={stepHref(choice.targetStepId)}
                    className={choiceLinkClassName}
                  >
                    {choice.label}
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    {choice.label} (missing step)
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
