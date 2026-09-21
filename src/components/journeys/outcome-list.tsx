"use client";

import { useState } from "react";

import { counted } from "@/components/journeys/editor-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GraphDocument } from "@/lib/graph/document";
import {
  addOutcome,
  endingCountsByOutcome,
  removeOutcome,
  renameOutcome,
} from "@/lib/graph/edit";

/**
 * The Journey's Outcomes, which are journey-scoped rather than per-Step: an
 * Author defines them here and tags each Ending with one in the step panel.
 *
 * Renaming edits the label in place and never the id, so every Ending already
 * tagged keeps its tag and so does every Run recorded against a Published
 * Version that used it.
 */
export function OutcomeList({
  document,
  onChange,
}: {
  document: GraphDocument;
  onChange: (document: GraphDocument) => void;
}) {
  const [label, setLabel] = useState("");

  const outcomes = Object.values(document.outcomes);
  const counts = endingCountsByOutcome(document);

  function add() {
    const trimmed = label.trim();
    if (trimmed.length === 0) return;

    onChange(addOutcome(document, trimmed).document);
    setLabel("");
  }

  return (
    <section aria-label="Outcomes" className="flex flex-col gap-3">
      <h3 className="text-lg font-medium tracking-tight">Outcomes</h3>

      {/* role="list" is explicit: the flex layout strips the list marker, and
          some browsers drop the implicit role with it. */}
      <ul role="list" aria-label="Outcomes" className="flex flex-col gap-2">
        {outcomes.map((outcome) => {
          // The rule `removeOutcome` itself applies: any Step still carrying
          // the id, not only the Endings the count is about.
          const inUse = Object.values(document.steps).some(
            (step) => step.outcomeId === outcome.id,
          );

          return (
            <li
              key={outcome.id}
              className="flex flex-col gap-2 rounded-xl px-3 py-2 ring-1 ring-foreground/10"
            >
              <Input
                aria-label="Outcome label"
                autoComplete="off"
                value={outcome.label}
                onChange={(event) =>
                  onChange(
                    renameOutcome(document, outcome.id, event.target.value),
                  )
                }
              />

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {counted(counts[outcome.id] ?? 0, "ending")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={inUse}
                  onClick={() => {
                    const result = removeOutcome(document, outcome.id);
                    if (result.ok) onChange(result.document);
                  }}
                >
                  Remove outcome
                </Button>
                {inUse ? (
                  <span className="text-muted-foreground text-sm">
                    Endings still use this outcome
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="new-outcome">New outcome</Label>
          <Input
            id="new-outcome"
            autoComplete="off"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <Button size="sm" disabled={label.trim().length === 0} onClick={add}>
          Add outcome
        </Button>
      </div>
    </section>
  );
}
