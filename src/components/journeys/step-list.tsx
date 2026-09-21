import { useEffect, useId, useMemo, useRef, useState } from "react";

import { counted, type SelectStep } from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { isEnding, type GraphDocument, type Step } from "@/lib/graph/document";
import { stepName } from "@/lib/graph/edit";
import { layoutGraph, mapOrder } from "@/lib/graph/layout";
import { cn } from "@/lib/utils";

/**
 * Every Step in the Draft, in the same order the map lays them out — top to
 * bottom, then left to right — behind a disclosure the Author opens to read
 * it. A Step no walk from the Start reaches is not set apart here any more:
 * it is marked on the map itself, and named in the live problems list above,
 * so this list is just the map's order read as text.
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
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  // The same order the map lays the boxes out in, so the list reads like the
  // map rather than like the order Steps happened to be created in.
  const order = useMemo(() => mapOrder(layoutGraph(document)), [document]);

  return (
    <section aria-label="Step list" className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        className="self-start text-sm font-medium hover:underline"
        onClick={() => setExpanded((current) => !current)}
      >
        Steps
      </button>

      {expanded ? (
        // role="list" is explicit: the flex layout strips the list marker,
        // and some browsers drop the implicit role with it.
        <ul
          id={listId}
          role="list"
          aria-label="Steps"
          className="flex flex-col gap-2"
        >
          {order.map((stepId) => (
            <StepItem
              key={stepId}
              document={document}
              step={document.steps[stepId]}
              selected={stepId === selectedStepId}
              onSelectStep={onSelectStep}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
