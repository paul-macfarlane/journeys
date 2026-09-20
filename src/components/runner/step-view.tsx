import Link from "next/link";

import { RichText } from "@/components/runner/rich-text";
import { buttonVariants } from "@/components/ui/button";
import { isEnding, type GraphDocument, type Step } from "@/lib/graph/document";
import { cn } from "@/lib/utils";

/**
 * One Step, rendered for whoever is walking the graph — the Preview runner
 * today (ticket 05), and the participant runner at `/j/{journey-id}` later
 * (ticket 06). This component knows nothing about Preview, Runs, or
 * Responses: the caller supplies every URL, so the same component serves
 * both.
 */

function EndingView({
  step,
  document,
  startOverHref,
}: {
  step: Step;
  document: GraphDocument;
  startOverHref: string;
}) {
  // `Object.hasOwn`, not `in` or bare indexing: the maps are plain objects
  // parsed from JSON, so an id like "toString" would otherwise find a
  // prototype method and read as a real Outcome.
  const outcome =
    step.outcomeId !== null && Object.hasOwn(document.outcomes, step.outcomeId)
      ? document.outcomes[step.outcomeId]
      : null;
  const outcomeLabel = outcome?.label ?? "No outcome yet";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">The end</h2>
      <p>Outcome: {outcomeLabel}</p>
      <Link
        href={startOverHref}
        className={cn(buttonVariants({ variant: "outline" }), "self-start")}
      >
        Start over
      </Link>
    </div>
  );
}

export function StepView({
  step,
  document,
  stepHref,
  startOverHref,
}: {
  step: Step;
  document: GraphDocument;
  stepHref: (stepId: string) => string;
  startOverHref: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
      <RichText content={step.content} />

      {isEnding(step) ? (
        <EndingView
          step={step}
          document={document}
          startOverHref={startOverHref}
        />
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
                  <Link
                    href={stepHref(choice.targetStepId)}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full justify-start",
                    )}
                  >
                    {choice.label}
                  </Link>
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
