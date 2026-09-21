import { useEffect, useRef } from "react";

import { counted, type SelectStep } from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { isEnding, type GraphDocument, type Step } from "@/lib/graph/document";
import { stepName, walkOrder } from "@/lib/graph/edit";
import { cn } from "@/lib/utils";

/**
 * Every Step in the Draft, in the order a participant could meet them — a
 * walk from the Start, first Choice first — with any Step no walk reaches
 * set apart underneath, and which one the panel is showing. The button
 * carries the title alone so it reads as the Step's name; the badges and the
 * choice count sit beside it rather than inside it.
 */

function StepItem({
  document,
  step,
  selected,
  onSelectStep,
}: {
  document: GraphDocument;
  step: Step;
  selected: boolean;
  onSelectStep: SelectStep;
}) {
  const ref = useRef<HTMLLIElement>(null);

  // Opening a Step from a Choice, a problem, or "Leads here from" can land
  // far down a long list; the list keeps up with the panel.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <li
      ref={ref}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ring-1",
        selected ? "bg-muted/50 ring-foreground/30" : "ring-foreground/10",
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

      {/* A brand-new Draft's one Step is both the Start and an Ending, and
          says so: it is where a participant would begin and, with no choices
          on it yet, where they would stop. */}
      {step.id === document.startStepId ? <Badge>Start</Badge> : null}
      {isEnding(step) ? <Badge>Ending</Badge> : null}
      {step.choices.length > 0 ? (
        <span className="text-muted-foreground text-sm">
          {counted(step.choices.length, "choice")}
        </span>
      ) : null}
    </li>
  );
}

export function StepList({
  document,
  selectedStepId,
  onSelectStep,
}: {
  document: GraphDocument;
  selectedStepId: string;
  onSelectStep: SelectStep;
}) {
  const order = walkOrder(document);

  return (
    <div className="flex flex-col gap-4">
      {/* role="list" is explicit: the flex layout strips the list marker, and
          some browsers drop the implicit role with it. */}
      <ul role="list" aria-label="Steps" className="flex flex-col gap-2">
        {order.reachable.map((stepId) => (
          <StepItem
            key={stepId}
            document={document}
            step={document.steps[stepId]}
            selected={stepId === selectedStepId}
            onSelectStep={onSelectStep}
          />
        ))}
      </ul>

      {/* Steps no Choice leads to, kept in sight so they are not lost: they
          are what "Add step" makes until a Choice points at them, and what
          a retarget or a delete leaves behind. Its label avoids the word
          "Steps" so the two lists stay distinguishable by name. */}
      {order.unreachable.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            Not reachable from the start
          </p>
          <ul
            role="list"
            aria-label="Not yet reached"
            className="flex flex-col gap-2"
          >
            {order.unreachable.map((stepId) => (
              <StepItem
                key={stepId}
                document={document}
                step={document.steps[stepId]}
                selected={stepId === selectedStepId}
                onSelectStep={onSelectStep}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
