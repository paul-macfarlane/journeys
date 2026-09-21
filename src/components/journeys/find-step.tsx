"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { counted, type SelectStep } from "@/components/journeys/editor-shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isEnding, type GraphDocument } from "@/lib/graph/document";
import { stepName } from "@/lib/graph/edit";
import { cn } from "@/lib/utils";

/**
 * "Find step": the way around a Draft by name, above the map, which is the
 * way around it by shape. Typing filters the Steps by their titles; choosing
 * one opens it in the panel and centers the map on its box, however far down
 * a forty-step Journey it sits.
 *
 * With nothing typed it offers every Step in the order the map lays the boxes
 * out — top to bottom, then left to right — so it reads the whole Draft the
 * way the map does. That order is handed down rather than computed here: the
 * editor lays the document out once, and both the map and this read the one
 * layout.
 *
 * A combobox on the app's own `Input`, not a new dependency: an input that
 * says what it controls and which option is active, and a listbox of options
 * beneath it. The Start and Ending badges and the choice count inside an
 * option are decoration — an option's accessible name is the Step's title
 * alone, which is what an Author is looking for and what a spec reads.
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
  const fieldId = useId();
  const listboxId = useId();
  const optionIdPrefix = useId();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const fieldRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const steps = order.map((stepId) => document.steps[stepId]);
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return steps;

    return steps.filter((step) =>
      stepName(step).toLowerCase().includes(needle),
    );
  }, [document, order, query]);

  // Typing can leave the active option past the end of what is left to
  // choose from, and a Draft that changed under the field can too.
  const active =
    matches.length === 0 ? -1 : Math.min(activeIndex, matches.length - 1);

  useEffect(() => {
    // The first render is nobody asking; every press after it is.
    if (focusRequest === 0) return;

    const field = fieldRef.current;
    if (field === null) return;
    field.focus();
    field.select();
  }, [focusRequest]);

  // Arrowing down a long Draft has to move the list, not just the highlight.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  /**
   * The Step the Author was looking for: opened in the panel and centered on
   * the map, with the field left empty and still theirs to type the next one
   * into.
   */
  function choose(stepId: string) {
    onSelectStep(stepId, { center: true });
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    fieldRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      if (matches.length === 0) return;

      // Wrapping, so the end of a long list is one press from its start.
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (current) =>
          (Math.min(current, matches.length - 1) + step + matches.length) %
          matches.length,
      );
      return;
    }

    if (event.key === "Enter") {
      if (!open || active < 0) return;
      // The Author is choosing a Step, not submitting anything around it.
      event.preventDefault();
      choose(matches[active].id);
      return;
    }

    if (event.key === "Escape") {
      // The list first and what was typed second: an Author who opened the
      // list by mistake puts it away without losing the query behind it.
      if (open) {
        setOpen(false);
        return;
      }
      setQuery("");
    }
  }

  return (
    <div className="relative max-w-sm">
      {/* The placeholder says the same thing, but a placeholder is not a
          name: the label is what the field is called, shown or not. */}
      <Label htmlFor={fieldId} className="sr-only">
        Find step
      </Label>

      <Input
        id={fieldId}
        ref={fieldRef}
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder="Find step…"
        aria-autocomplete="list"
        aria-expanded={open}
        // The listbox is rendered only while the field is open, so the id is
        // only named while there is something for it to name.
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && active >= 0 ? `${optionIdPrefix}-${active}` : undefined
        }
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />

      {open ? (
        // Over the map rather than pushing it down: what is being looked for
        // is a Step on that map, and the map is what the answer moves.
        <div className="absolute inset-x-0 top-full z-20 mt-1 flex max-h-80 flex-col overflow-y-auto rounded-xl bg-background p-1 ring-1 ring-foreground/10">
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Steps"
            className="flex flex-col gap-1"
          >
            {matches.map((step, index) => (
              <li
                key={step.id}
                id={`${optionIdPrefix}-${index}`}
                role="option"
                aria-selected={index === active}
                aria-label={stepName(step)}
                // A pointer going down on an option must not blur the field
                // first: the blur would close the list out from under the
                // click that was about to choose from it.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(step.id)}
                className={cn(
                  "flex cursor-pointer flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5",
                  index === active ? "bg-muted" : null,
                )}
              >
                <span className="text-sm font-medium">{stepName(step)}</span>

                {/* A brand-new Draft's one Step is both the Start and an
                    Ending, and says so: it is where a participant would
                    begin and, with no choices on it yet, where they would
                    stop. */}
                {step.id === document.startStepId ? <Badge>Start</Badge> : null}
                {isEnding(step) ? <Badge>Ending</Badge> : null}
                {step.choices.length > 0 ? (
                  <span className="text-muted-foreground text-sm">
                    {counted(step.choices.length, "choice")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          {matches.length === 0 ? (
            <p className="px-2.5 py-1.5 text-sm text-muted-foreground">
              No steps match
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
