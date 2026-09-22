"use client";

import { useMemo } from "react";

import { Combobox, type ComboboxOption } from "@/components/journeys/combobox";
import { counted, type SelectStep } from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { isEnding, type GraphDocument } from "@/lib/graph/document";
import { stepName } from "@/lib/graph/edit";

/**
 * "Find step": the way around a Draft by name, above the map, which is the
 * way around it by shape. Typing filters the Steps by their titles; choosing
 * one opens it in the panel and zooms the map to its box, however far down a
 * forty-step Journey it sits.
 *
 * With nothing typed it offers every Step in the order the map lays the boxes
 * out — top to bottom, then left to right — so it reads the whole Draft the
 * way the map does. That order is handed down rather than computed here: the
 * editor lays the document out once, and both the map and this read the one
 * layout.
 *
 * The field itself is the editor's shared `Combobox`, in its query-only way:
 * the Step chosen is opened rather than named in the field, which is left
 * empty for the next one.
 */
export function FindStep({
  document,
  order,
  focusRequest,
  onSelectStep,
}: {
  document: GraphDocument;
  /**
   * Step ids in the order the map lays the boxes out, so the Steps offered
   * read like the map rather than like the order they were created in.
   */
  order: string[];
  /**
   * Counts the times Cmd/Ctrl+K asked for this field, so a second press after
   * the Author has typed something puts them back in it with what they typed
   * selected, rather than doing nothing because the field never changed.
   */
  focusRequest: number;
  onSelectStep: SelectStep;
}) {
  const options = useMemo<ComboboxOption[]>(
    () =>
      order.map((stepId) => {
        const step = document.steps[stepId];
        const title = stepName(step);

        return {
          id: step.id,
          name: title,
          render: (
            <>
              <span className="text-sm font-medium">{title}</span>

              {/* A brand-new Draft's one Step is both the Start and an
                  Ending, and says so: it is where a participant would begin
                  and, with no choices on it yet, where they would stop. */}
              {step.id === document.startStepId ? <Badge>Start</Badge> : null}
              {isEnding(step) ? <Badge>Ending</Badge> : null}
              {step.choices.length > 0 ? (
                <span className="text-muted-foreground text-sm">
                  {counted(step.choices.length, "choice")}
                </span>
              ) : null}
            </>
          ),
        };
      }),
    [document, order],
  );

  return (
    <Combobox
      label="Find step"
      labelHidden
      listLabel="Steps"
      placeholder="Find step…"
      emptyMessage="No steps match"
      className="max-w-sm"
      options={options}
      focusRequest={focusRequest}
      onChoose={(stepId) => onSelectStep(stepId, { zoom: true })}
    />
  );
}
