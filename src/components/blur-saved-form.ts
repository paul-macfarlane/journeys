import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type KeyboardEvent } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from "react-hook-form";
import type { z } from "zod";

import type { ActionResult } from "@/lib/action-result";

/**
 * A record edited in place rather than behind an Edit button: fields that
 * read as text until focused, each saving the whole record when it is left
 * (or, for a one-line field, on Enter). The Journey's title and description
 * and the Project's settings both work this way, and this is the part they
 * share: the react-hook-form and zod pairing the dialogs use, submitted
 * from a blur instead of a button, so a save that fails says so under the
 * field that asked for it and keeps what was typed.
 *
 * `values` are what the server currently holds, as one object memoized on
 * its fields (a fresh object every render would re-adopt every render). A
 * refresh carrying a value this form did not save is another Member's
 * edit: adopted into a field the Author has not touched, and left for the
 * Author's own blur to overwrite in one they are mid-edit in, as last
 * write wins.
 */
export function useBlurSavedForm<T extends FieldValues>({
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
  /** After a save the server accepted, typically a router refresh. */
  onSaved: () => void;
}) {
  const form = useForm<T, unknown, T>({
    // The resolver's own generics land on `FieldValues`; `T` is what the
    // schema parses to, which is what every caller's fields are typed as.
    resolver: zodResolver(schema) as Resolver<T, unknown, T>,
    defaultValues: values as DefaultValues<T>,
  });
  const { reset } = form;

  useEffect(() => {
    reset(values, { keepDirtyValues: true });
  }, [reset, values]);

  /** The whole record, as the action takes it, from one field's blur. */
  function save(field: Path<T>) {
    return form.handleSubmit(async (next) => {
      const saved = form.formState.defaultValues as Partial<T> | undefined;
      if (saved && Object.keys(next).every((key) => next[key] === saved[key])) {
        return;
      }

      const result = await submit(next).catch(() => ({
        ok: false as const,
        error: "the server could not be reached",
      }));

      if (!result.ok) {
        form.setError(field, {
          type: "server",
          message: `Couldn't save: ${result.error}`,
        });
        return;
      }

      // The schema trims, so what stays on screen is what was stored.
      form.reset(next);
      onSaved();
    })();
  }

  /** Enter in a one-line field: blurring is the save, Enter only decides when. */
  function handleEnterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.blur();
  }

  return { form, save, handleEnterKeyDown };
}
