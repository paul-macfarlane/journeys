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
  const outcome = step.outcomeId ? document.outcomes[step.outcomeId] : null;
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
        <ul role="list" className="flex flex-col gap-2">
          {step.choices.map((choice) => {
            const targetExists = choice.targetStepId in document.steps;
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
