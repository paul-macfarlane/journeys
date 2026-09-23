"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";

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
 * How tall the open list can be — `max-h-80` in pixels — which is the room a
 * field needs beneath it before the list is opened downwards.
 */
const LIST_MAX_HEIGHT = 320;

/**
 * The first thing above the field that would cut the list off: the panel's
 * own column clips what overflows it, so a field low in a tall panel has
 * less room beneath it than the window suggests. `null` when nothing clips.
 */
function clippingAncestor(field: HTMLElement): HTMLElement | null {
  for (
    let parent = field.parentElement;
    parent !== null;
    parent = parent.parentElement
  ) {
    if (window.getComputedStyle(parent).overflowY !== "visible") return parent;
  }
  return null;
}

/**
 * The options left once `query` has filtered them by name, and — offered
 * after them whatever was typed — the `action` built from the query.
 * `matches` is the filtered options alone, which is what decides whether
 * the list says nothing matched.
 */
function useFilteredOptions(
  options: ComboboxOption[],
  action: ((query: string) => ComboboxOption | null) | undefined,
  query: string,
) {
  return useMemo(() => {
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
}

/**
 * The active option kept inside the list: typing can leave it past the end
 * of what is left to choose from, and a Draft that changed under the field
 * can too. `-1` when there is nothing to choose.
 */
function clampActive(activeIndex: number, length: number): number {
  return length === 0 ? -1 : Math.min(activeIndex, length - 1);
}

/**
 * One arrow press from `current`, wrapping, so the end of a long list is one
 * press from its start.
 */
function wrapActive(current: number, step: 1 | -1, length: number): number {
  return (Math.min(current, length - 1) + step + length) % length;
}

/**
 * Which side of `anchor` the list opens on, settled as it opens and not
 * after: the panel's column clips what overflows it, so a list opened
 * downwards from a field near the foot of a tall panel is cut off with
 * nothing an Author can do to reach the rest of it. It opens upwards when
 * there is not the room for it below and there is more of it above.
 */
function useOpensAbove(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
): boolean {
  const [above, setAbove] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;

    const anchor = anchorRef.current;
    if (anchor === null) return;

    const bounds = anchor.getBoundingClientRect();
    const clip = clippingAncestor(anchor)?.getBoundingClientRect() ?? null;
    // The window cuts the list off as surely as a column does, so the nearer
    // of the two edges is the one the room is measured to.
    const floor = Math.min(window.innerHeight, clip?.bottom ?? Infinity);
    const ceiling = Math.max(0, clip?.top ?? 0);

    const below = floor - bounds.bottom;
    const room = bounds.top - ceiling;
    setAbove(below < LIST_MAX_HEIGHT && room > below);
  }, [anchorRef, open]);

  return above;
}

/** Arrowing down a long list has to move the list, not just the highlight. */
function useActiveInView(
  listRef: RefObject<HTMLUListElement | null>,
  active: number,
  open: boolean,
) {
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, listRef, open]);
}

/**
 * The open list itself, over whatever is beneath rather than pushing it
 * down: what is being chosen is about the thing the field sits on. `header`
 * is drawn above the options, inside the list's frame — the filter of a
 * field that reads as a select.
 */
function OptionList({
  above,
  header,
  listRef,
  listboxId,
  listLabel,
  optionIdPrefix,
  options,
  active,
  chosenId,
  emptyMessage,
  empty,
  onChoose,
}: {
  above: boolean;
  header?: ReactNode;
  listRef: RefObject<HTMLUListElement | null>;
  listboxId: string;
  listLabel: string;
  optionIdPrefix: string;
  options: ComboboxOption[];
  active: number;
  /** The option chosen now, marked with a check as decoration. */
  chosenId?: string;
  emptyMessage: string;
  /** Whether nothing matched, which the list then says. */
  empty: boolean;
  onChoose: (id: string) => void;
}) {
  return (
    <div
      // A pointer going down on the list's own padding, the gap between
      // options, or the "nothing matched" line must not take the focus off
      // the field either — only the header's own field may have it.
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
      className={cn(
        "absolute left-0 z-20 flex max-h-80 w-full min-w-56 flex-col overflow-y-auto rounded-xl bg-background p-1 ring-1 ring-foreground/10",
        above ? "bottom-full mb-1" : "top-full mt-1",
      )}
    >
      {header}

      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={listLabel}
        className="flex flex-col gap-1"
      >
        {options.map((option, index) => (
          <li
            key={option.id}
            id={`${optionIdPrefix}-${index}`}
            role="option"
            aria-selected={index === active}
            aria-label={option.name}
            // A pointer going down on an option must not blur the field
            // first: the blur would close the list out from under the click
            // that was about to choose from it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(option.id)}
            className={cn(
              "flex cursor-pointer flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5",
              index === active ? "bg-muted" : null,
            )}
          >
            {option.render ?? (
              <span className="text-sm font-medium">{option.name}</span>
            )}
            {chosenId !== undefined && option.id === chosenId ? (
              <CheckIcon aria-hidden className="ml-auto size-4" />
            ) : null}
          </li>
        ))}
      </ul>

      {empty ? (
        <p className="px-2.5 py-1.5 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}

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
 * names what is chosen — a Choice's target — so the field reads as the
 * answer rather than as a search; focusing it selects that name so typing
 * replaces it, and leaving without choosing puts it back.
 *
 * `action` is the option that is not one of the options: "New step…" after
 * the Steps. It is offered after the matches whatever was typed, and it is
 * handed the query so it can say what it would make.
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

  const entries = useFilteredOptions(options, action, query);
  const active = clampActive(activeIndex, entries.options.length);
  const above = useOpensAbove(open, fieldRef);
  useActiveInView(listRef, active, open);

  useEffect(() => {
    // The first render is nobody asking; every ask after it is.
    if (focusRequest === 0) return;

    const field = fieldRef.current;
    if (field === null) return;
    field.focus();
    field.select();
  }, [focusRequest]);

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

      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        wrapActive(current, step, entries.options.length),
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
        <OptionList
          above={above}
          listRef={listRef}
          listboxId={listboxId}
          listLabel={listLabel}
          optionIdPrefix={optionIdPrefix}
          options={entries.options}
          active={active}
          emptyMessage={emptyMessage}
          empty={entries.matches.length === 0}
          onChoose={choose}
        />
      ) : null}
    </div>
  );
}

/**
 * A field that reads as a select — ARIA's select-only combobox — for a
 * choice that can also make what it chooses: closed, a button naming what is
 * chosen with a chevron beside it; open, a list with a filter at its top.
 * The filter narrows the options by name the way the `Combobox` field does,
 * and `action` is offered after the matches for what was typed ("Create
 * outcome “…”"). The arrows walk the list from the filter and wrap, Enter
 * takes the one in hand, Escape puts the list away; each of those, and every
 * choice, hands the focus back to the button. Tab, or a click anywhere else,
 * puts the list away too.
 */
export function SelectCombobox({
  label,
  listLabel,
  filterLabel,
  filterPlaceholder,
  options,
  action,
  value,
  chosenId,
  emptyMessage,
  className,
  onChoose,
}: {
  /** What the control is called: its label, and its accessible name. */
  label: string;
  /** What the list of options is called, in the plural: "Outcomes". */
  listLabel: string;
  /** What the filter at the top of the list is called: "Filter outcomes". */
  filterLabel: string;
  filterPlaceholder?: string;
  options: ComboboxOption[];
  /** The option offered after the matches, built from what has been typed. */
  action?: (query: string) => ComboboxOption | null;
  /** What the closed control reads as: the name of what is chosen now. */
  value: string;
  /** The option chosen now, checked in the open list. */
  chosenId?: string;
  /** What is said in place of an empty list: "No outcomes match". */
  emptyMessage: string;
  className?: string;
  onChoose: (id: string, query: string) => void;
}) {
  const triggerId = useId();
  const listboxId = useId();
  const optionIdPrefix = useId();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const entries = useFilteredOptions(options, action, query);
  const active = clampActive(activeIndex, entries.options.length);
  const above = useOpensAbove(open, triggerRef);
  useActiveInView(listRef, active, open);

  // The filter is where the Author is once the list is open: typing narrows
  // it straight away, and the arrows walk it from there.
  useEffect(() => {
    if (open) filterRef.current?.focus();
  }, [open]);

  function show() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function hide(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(id: string) {
    onChoose(id, query.trim());
    hide(true);
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (entries.options.length === 0) return;

      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        wrapActive(current, step, entries.options.length),
      );
      return;
    }

    if (event.key === "Enter") {
      // The Author is choosing, not submitting anything around the field.
      event.preventDefault();
      if (active >= 0) choose(entries.options[active].id);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      hide(true);
      return;
    }

    // Leaving the list by the keyboard, either way, puts it away.
    if (event.key === "Tab") hide(false);
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative flex flex-col gap-2", className)}
      onBlur={(event) => {
        // Focus going anywhere outside the control — a click elsewhere, or
        // the Author tabbing on — puts the list away.
        const next = event.relatedTarget;
        if (
          open &&
          !(next instanceof Node && rootRef.current?.contains(next) === true)
        ) {
          setOpen(false);
        }
      }}
    >
      <Label htmlFor={triggerId}>{label}</Label>

      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        // The listbox is rendered only while the control is open, so the id
        // is only named while there is something for it to name.
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? hide(false) : show())}
        // Safari and Firefox do not focus a button on click, so the filter's
        // blur would arrive with no `relatedTarget`, close the list, and the
        // click would then open it again; keeping the pointer from moving
        // focus leaves the click as the one toggle it is.
        onMouseDown={(event) => {
          if (open) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
          }
        }}
        className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      >
        <span className="truncate">{value}</span>
        <ChevronDownIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
      </button>

      {open ? (
        <OptionList
          above={above}
          header={
            <div className="sticky top-0 z-10 bg-background pb-1">
              <Input
                ref={filterRef}
                type="text"
                role="combobox"
                aria-label={filterLabel}
                autoComplete="off"
                placeholder={filterPlaceholder}
                aria-autocomplete="list"
                aria-expanded
                aria-controls={listboxId}
                aria-activedescendant={
                  active >= 0 ? `${optionIdPrefix}-${active}` : undefined
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleFilterKeyDown}
              />
            </div>
          }
          listRef={listRef}
          listboxId={listboxId}
          listLabel={listLabel}
          optionIdPrefix={optionIdPrefix}
          options={entries.options}
          active={active}
          chosenId={chosenId}
          emptyMessage={emptyMessage}
          empty={entries.matches.length === 0}
          onChoose={choose}
        />
      ) : null}
    </div>
  );
}
