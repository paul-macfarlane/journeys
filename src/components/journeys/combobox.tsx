"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * One thing to choose: the `id` it is chosen by, the `name` it is found and
 * read out by, and optionally the way it is drawn — badges, counts, anything
 * beside the name is decoration, and an option's accessible name stays the
 * name alone, which is what an Author is looking for and what a spec reads.
 */
export type ComboboxOption = {
  id: string;
  name: string;
  render?: ReactNode;
};

/**
 * The editor's one combobox: a field on the app's own `Input`, not a new
 * dependency, that says what it controls and which option is active, and a
 * listbox of options beneath it. Typing filters the options by name; the
 * arrows walk them and wrap, Enter takes the one in hand, Escape puts the
 * list away and then what was typed.
 *
 * Two ways a field can read while it is closed. With no `value` it is a
 * query and nothing else — "Find step", which keeps the map's own way around
 * the Draft and leaves the field empty for the next one. With a `value` it
 * names what is chosen — a Choice's target, an Ending's Outcome — so the
 * field reads as the answer rather than as a search; focusing it selects that
 * name so typing replaces it, and leaving without choosing puts it back.
 *
 * `action` is the option that is not one of the options: "New step…" after
 * the Steps, "Create outcome “…”" after the Outcomes. It is offered after the
 * matches whatever was typed, and it is handed the query so it can say what
 * it would make.
 */
export function Combobox({
  label,
  labelHidden = false,
  listLabel,
  options,
  action,
  value,
  placeholder,
  emptyMessage,
  className,
  focusRequest = 0,
  onChoose,
}: {
  /** What the field is called, shown or not: a placeholder is not a name. */
  label: string;
  labelHidden?: boolean;
  /** What the list of options is called, in the plural: "Steps", "Outcomes". */
  listLabel: string;
  options: ComboboxOption[];
  /** The option offered after the matches, built from what has been typed. */
  action?: (query: string) => ComboboxOption | null;
  /**
   * The name of what is chosen now, for a field that names its value. Left
   * undefined by a field that is only ever a query.
   */
  value?: string;
  placeholder?: string;
  /** What is said in place of an empty list: "No steps match". */
  emptyMessage: string;
  className?: string;
  /**
   * Counts the times the field was asked for from outside, so asking twice
   * puts the Author back in it with what they typed selected, rather than
   * doing nothing because the field never changed.
   */
  focusRequest?: number;
  onChoose: (id: string, query: string) => void;
}) {
  const fieldId = useId();
  const listboxId = useId();
  const optionIdPrefix = useId();

  const namesValue = value !== undefined;

  /**
   * What has been typed since the field was last left or chosen from. `null`
   * is nothing yet, which is what lets a field that names its value show that
   * name while still offering every option.
   */
  const [typed, setTyped] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const fieldRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const query = typed ?? "";
  const text = typed ?? value ?? "";

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches =
      needle.length === 0
        ? options
        : options.filter((option) =>
            option.name.toLowerCase().includes(needle),
          );

    const trailing = action?.(query) ?? null;
    return {
      matches,
      options: trailing === null ? matches : [...matches, trailing],
    };
  }, [action, options, query]);

  // Typing can leave the active option past the end of what is left to
  // choose from, and a Draft that changed under the field can too.
  const active =
    entries.options.length === 0
      ? -1
      : Math.min(activeIndex, entries.options.length - 1);

  useEffect(() => {
    // The first render is nobody asking; every ask after it is.
    if (focusRequest === 0) return;

    const field = fieldRef.current;
    if (field === null) return;
    field.focus();
    field.select();
  }, [focusRequest]);

  // Arrowing down a long list has to move the list, not just the highlight.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(id: string) {
    onChoose(id, query.trim());
    setOpen(false);
    // A field that names its value shows what was just chosen; one that is
    // only a query is left empty and still theirs to type the next one into.
    setTyped(namesValue ? null : "");
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
      if (entries.options.length === 0) return;

      // Wrapping, so the end of a long list is one press from its start.
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (current) =>
          (Math.min(current, entries.options.length - 1) +
            step +
            entries.options.length) %
          entries.options.length,
      );
      return;
    }

    if (event.key === "Enter") {
      if (!open || active < 0) return;
      // The Author is choosing, not submitting anything around the field.
      event.preventDefault();
      choose(entries.options[active].id);
      return;
    }

    if (event.key === "Escape") {
      // The list first and what was typed second: an Author who opened the
      // list by mistake puts it away without losing the query behind it.
      if (open) {
        setOpen(false);
        return;
      }
      setTyped(namesValue ? null : "");
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Label htmlFor={fieldId} className={labelHidden ? "sr-only" : undefined}>
        {label}
      </Label>

      <Input
        id={fieldId}
        ref={fieldRef}
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open}
        // The listbox is rendered only while the field is open, so the id is
        // only named while there is something for it to name.
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && active >= 0 ? `${optionIdPrefix}-${active}` : undefined
        }
        value={text}
        onChange={(event) => {
          setTyped(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={(event) => {
          setOpen(true);
          // The name of what is chosen, selected rather than left with a
          // caret in it: typing replaces the answer, it does not edit it.
          if (namesValue) event.target.select();
        }}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (namesValue) setTyped(null);
        }}
        onKeyDown={handleKeyDown}
      />

      {open ? (
        // Over whatever is beneath rather than pushing it down: what is being
        // chosen is about the thing the field sits on.
        <div className="absolute top-full left-0 z-20 mt-1 flex max-h-80 w-full min-w-56 flex-col overflow-y-auto rounded-xl bg-background p-1 ring-1 ring-foreground/10">
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={listLabel}
            className="flex flex-col gap-1"
          >
            {entries.options.map((option, index) => (
              <li
                key={option.id}
                id={`${optionIdPrefix}-${index}`}
                role="option"
                aria-selected={index === active}
                aria-label={option.name}
                // A pointer going down on an option must not blur the field
                // first: the blur would close the list out from under the
                // click that was about to choose from it.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.id)}
                className={cn(
                  "flex cursor-pointer flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5",
                  index === active ? "bg-muted" : null,
                )}
              >
                {option.render ?? (
                  <span className="text-sm font-medium">{option.name}</span>
                )}
              </li>
            ))}
          </ul>

          {entries.matches.length === 0 ? (
            <p className="px-2.5 py-1.5 text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
