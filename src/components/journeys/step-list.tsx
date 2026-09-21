"use client";

import { counted } from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { isEnding, type GraphDocument } from "@/lib/graph/document";
import { stepName } from "@/lib/graph/edit";
import { cn } from "@/lib/utils";

/**
 * Every Step in the Draft, in document order, and which one the panel is
 * showing. The button carries the title alone so it reads as the Step's name;
 * the badges and the choice count sit beside it rather than inside it.
 */
export function StepList({
  document,
  selectedStepId,
  onSelectStep,
}: {
  document: GraphDocument;
  selectedStepId: string;
  onSelectStep: (stepId: string) => void;
}) {
  return (
    // role="list" is explicit: the flex layout strips the list marker, and
    // some browsers drop the implicit role with it.
    <ul role="list" aria-label="Steps" className="flex flex-col gap-2">
      {Object.values(document.steps).map((step) => {
        const selected = step.id === selectedStepId;

        return (
          <li
            key={step.id}
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ring-1",
              selected
                ? "bg-muted/50 ring-foreground/30"
                : "ring-foreground/10",
            )}
          >
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              className="rounded-sm text-left text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => onSelectStep(step.id)}
            >
              {stepName(step)}
            </button>

            {/* A brand-new Draft's one Step is both the Start and an Ending,
                and says so: it is where a participant would begin and, with
                no choices on it yet, where they would stop. */}
            {step.id === document.startStepId ? <Badge>Start</Badge> : null}
            {isEnding(step) ? <Badge>Ending</Badge> : null}
            {step.choices.length > 0 ? (
              <span className="text-muted-foreground text-sm">
                {counted(step.choices.length, "choice")}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
