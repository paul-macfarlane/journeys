import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from "react-hook-form";
import type { z } from "zod";

import { useAutosave } from "@/components/autosave";
import type { ActionResult } from "@/lib/action-result";
import type { SaveStatus } from "@/lib/autosave";

/**
 * A record edited in place rather than behind an Edit button: fields that
 * read as text until focused, the whole record saved as it is typed into
 * (ticket 46) — once typing pauses, when a field is left, when the surface
 * unmounts, and on the way out of the page. The Journey's title and
 * description, the Project's title, and the Theme picker all work this way,
 * and this is the part they share: the react-hook-form and zod pairing the
 * dialogs use, submitted by the autosave loop instead of a button, so a
 * save that fails says so under the field last typed into and keeps what
 * was typed, and one status line per form says where the record stands.
 *
 * `values` are what the server currently holds, as one object memoized on
 * its fields (a fresh object every render would re-adopt every render). A
 * refresh carrying a value this form did not save is another Member's
 * edit: adopted into a field the Author has not touched, and left for the
 * Author's own next save to overwrite in one they are mid-edit in, as last
 * write wins. The refresh a save asks for can land while the next field is
 * being typed into, so the mid-edit text is kept as an edit still to save,
 * never mistaken for the baseline.
 */
export function useAutosavedForm<T extends FieldValues>({
  schema,
  values,
  submit,
  onSaved,
}: {
  /** The zod object the record must parse as; `T` is its output. */
  schema: z.ZodType<T, FieldValues>;
  values: T;
  /** The server action the whole record goes to. */
  submit: (values: T) => Promise<ActionResult>;
  /** After a save the server accepted with nothing left to write, typically a router refresh. */
  onSaved: () => void;
}): {
  form: ReturnType<typeof useForm<T, unknown, T>>;
  status: SaveStatus;
  /** A field has changed: the record is written once typing pauses. */
  change: (field: Path<T>) => void;
  /** A field was left, or a control saves on change: the record is written now. */
  flush: (field: Path<T>) => Promise<void>;
  handleEnterKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
} {
  const form = useForm<T, unknown, T>({
    // The resolver's own generics land on `FieldValues`; `T` is what the
    // schema parses to, which is what every caller's fields are typed as.
    resolver: zodResolver(schema) as Resolver<T, unknown, T>,
    defaultValues: values as DefaultValues<T>,
    // A save runs as a field is left, so a refused one must not pull focus
    // back to the first invalid field: the Author has already moved on to
    // the next one, and what they type there would land in the old one.
    shouldFocusError: false,
  });

  // The field a refused save is blamed on: the one last typed into, since
  // with a timer doing the saving there is no blur to name one.
  const lastEditedField = useRef<Path<T> | null>(null);

  // Two records are the same when they would be stored the same, which is
  // after the schema has trimmed them: a trailing space left on screen is
  // not an edit to write again.
  const sameStored = useCallback(
    (a: T, b: T) => sameRecord(asStored(schema, a), asStored(schema, b)),
    [schema],
  );

  const { status, autosave } = useAutosave<T>({
    initial: values,
    equals: sameStored,
    // The schema is run here rather than through `form.handleSubmit`: that
    // returns without calling either of its callbacks when a `reset` lands
    // while it validates (react-hook-form's `_resetCallId` check), and the
    // refresh the previous save asked for resets this form — so a field
    // left the moment that refresh arrived was a write that never settled,
    // "Saving…" for good with no refusal shown (the author-settings spec,
    // once locally and once on CI, 2026-09-24). `value` is what the loop
    // read the moment `change` stored it, so validating it directly checks
    // exactly what `handleSubmit` would have.
    write: async (value) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        form.clearErrors();
        const blamed = new Set<string>();
        for (const issue of parsed.error.issues) {
          const field = String(
            issue.path[0] ?? lastEditedField.current ?? Object.keys(value)[0],
          ) as Path<T>;
          if (blamed.has(field)) continue;
          blamed.add(field);
          form.setError(field, { type: "validate", message: issue.message });
        }
        return false;
      }

      form.clearErrors();
      const result = await submit(parsed.data).catch(() => ({
        ok: false as const,
        error: "the server could not be reached",
      }));

      if (!result.ok) {
        const field =
          lastEditedField.current ?? (Object.keys(value)[0] as Path<T>);
        form.setError(field, {
          type: "server",
          message: `Couldn't save: ${result.error}`,
        });
        return false;
      }

      // The schema trims, so the baseline is what was stored; what is on
      // screen is left as typed, because the Author may still be typing it
      // — `flush` puts the stored form on screen once the field is left.
      form.reset(parsed.data, { keepValues: true });
      return true;
    },
    onSaved,
  });

  useEffect(() => {
    // Adopt the server's values as the baseline, then put back whatever the
    // Author has changed since the last baseline, still marked as theirs.
    // Not react-hook-form's `keepDirtyValues`: that folds the kept text into
    // the new defaults, so a refresh landing while a field is mid-edit —
    // the previous save refreshing the page — makes the edit look already
    // saved, and the save that follows writes nothing.
    const before = form.formState.defaultValues as Partial<T> | undefined;
    const current = form.getValues();
    form.reset(values);
    for (const key of Object.keys(values) as Path<T>[]) {
      if (before && current[key] !== before[key]) {
        form.setValue(key, current[key], { shouldDirty: true });
      }
    }
    // The loop's own view of the same thing: the record it writes next is
    // the server's values with the Author's edits over them.
    autosave.adopt(values, (incoming, edited, lastSaved) => {
      const merged = { ...incoming };
      for (const key of Object.keys(incoming) as Path<T>[]) {
        if (edited[key] !== lastSaved[key]) merged[key] = edited[key];
      }
      return merged;
    });
  }, [autosave, form, values]);

  const change = useCallback(
    (field: Path<T>) => {
      lastEditedField.current = field;
      autosave.change({ ...form.getValues() });
    },
    [autosave, form],
  );

  const flush = useCallback(
    async (field: Path<T>) => {
      lastEditedField.current = field;
      autosave.change({ ...form.getValues() });
      await autosave.flush();
      // The field was left with everything written: what it shows becomes
      // what was stored (the schema trims), which is the baseline now.
      if (!autosave.isDirty()) form.resetField(field);
    },
    [autosave, form],
  );

  /** Enter in a one-line field: leaving it is the save, Enter only decides when. */
  function handleEnterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.blur();
  }

  return { form, status, change, flush, handleEnterKeyDown };
}

/** What the record would be stored as; as typed, if it would be refused. */
function asStored<T extends FieldValues>(
  schema: z.ZodType<T, FieldValues>,
  value: T,
): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : value;
}

/** Two records are the same when every field reads the same. */
function sameRecord<T extends FieldValues>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
