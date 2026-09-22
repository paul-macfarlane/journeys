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
 *
 * The one exception is the Start Step of a live Journey, whose Choices are
 * submit buttons in a form (ticket 27): taking one is what creates the Run,
 * and a write belongs to a POST an action owns, not to a link somebody can
 * prefetch. The caller says which it wants through `choices`.
 */

/**
 * A Choice: full width, wrapping, and tall enough to be a comfortable tap
 * target on a phone. Exported so the runner's own controls — "Start over",
 * "Continue where you left off" — match the Choices they sit beside.
 */
export const choiceLinkClassName = cn(
  buttonVariants({ variant: "outline" }),
  "h-auto min-h-11 w-full justify-start py-3 text-left whitespace-normal",
);

/**
 * How a Step's Choices are offered: as links to the Step each leads to, or
 * as the buttons of one form whose action receives the chosen Step's id in
 * its `to` field.
 */
export type ChoiceControls =
  | { kind: "links"; href: (stepId: string) => string }
  | { kind: "form"; action: (formData: FormData) => Promise<void> };

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
       * An untagged Ending says nothing here: what an Author has or has not
       * grouped is authoring state, not a Participant's.
       */}
      {outcome === null ? null : <p>Outcome: {outcome.label}</p>}
      {startOver}
    </div>
  );
}

function ChoiceList({
  step,
  document,
  choices,
}: {
  step: Step;
  document: GraphDocument;
  choices: ChoiceControls;
}) {
  // role="list" is explicit: the flex layout strips the list marker, and
  // some browsers drop the implicit role with it.
  const list = (
    <ul role="list" aria-label="Choices" className="flex flex-col gap-2">
      {step.choices.map((choice) => {
        // Own property only — see the Outcome lookup above.
        const targetExists = Object.hasOwn(document.steps, choice.targetStepId);
        return (
          <li key={choice.id}>
            {!targetExists ? (
              <span className="text-muted-foreground">
                {choice.label} (missing step)
              </span>
            ) : choices.kind === "links" ? (
              <a
                href={choices.href(choice.targetStepId)}
                className={choiceLinkClassName}
              >
                {choice.label}
              </a>
            ) : (
              <button
                type="submit"
                name="to"
                value={choice.targetStepId}
                className={choiceLinkClassName}
              >
                {choice.label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  return choices.kind === "form" ? (
    <form action={choices.action}>{list}</form>
  ) : (
    list
  );
}

export function StepView({
  step,
  document,
  choices,
  startOver,
}: {
  step: Step;
  document: GraphDocument;
  choices: ChoiceControls;
  startOver: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
      <RichText content={step.content} />

      {isEnding(step) ? (
        <EndingView step={step} document={document} startOver={startOver} />
      ) : (
        <ChoiceList step={step} document={document} choices={choices} />
      )}
    </div>
  );
}
