"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";

import { updateJourneyAction } from "@/app/projects/[projectId]/journeys/actions";
import { cn } from "@/lib/utils";
import {
  updateJourneySchema,
  type UpdateJourneyInput,
} from "@/lib/validation/journey";

type Field = keyof UpdateJourneyInput;

/**
 * A Journey's title and description are the whole of its metadata, so they
 * are the page's heading rather than a form behind an Edit button: two
 * borderless fields that read as headings until focused. The same
 * react-hook-form and zod pairing as the dialogs, submitted from each
 * field's blur (the title's Enter too) instead of a button, so a save that
 * fails says so under the field that asked for it and keeps what was typed.
 *
 * The Journey is addressed by its id, so a rename never moves the page.
 */
export function JourneyTitleFields({
  projectId,
  journeyId,
  title,
  description,
}: {
  projectId: string;
  journeyId: string;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const form = useForm<UpdateJourneyInput>({
    resolver: zodResolver(updateJourneySchema),
    defaultValues: { title, description },
  });
  const { errors } = form.formState;

  // A refresh carrying a value this form did not save is another Member's
  // edit: adopted into a field the Author has not touched, and left for the
  // Author's own blur to overwrite in one they are mid-edit in, as last
  // write wins.
  useEffect(() => {
    form.reset({ title, description }, { keepDirtyValues: true });
  }, [form, title, description]);

  /** The whole record, as the update action takes it, from one field's blur. */
  function save(field: Field) {
    return form.handleSubmit(async (values) => {
      const saved = form.formState.defaultValues;
      if (
        values.title === saved?.title &&
        values.description === saved?.description
      ) {
        return;
      }

      const result = await updateJourneyAction(
        projectId,
        journeyId,
        values,
      ).catch(() => ({
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
      form.reset(values);
      // The refresh is what lets Publish notice participants have not seen
      // this yet, and what puts the new title on the Delete confirmation.
      router.refresh();
    })();
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // Blurring is the save; Enter only decides when.
    event.currentTarget.blur();
  }

  const fieldClassName =
    "-mx-1.5 w-full min-w-0 rounded-md bg-transparent px-1.5 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:ring-2 aria-invalid:ring-destructive/40";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <input
        aria-label="Title"
        aria-invalid={errors.title ? true : undefined}
        autoComplete="off"
        {...form.register("title", { onBlur: () => void save("title") })}
        onKeyDown={handleTitleKeyDown}
        className={cn(
          fieldClassName,
          "py-0.5 text-2xl font-semibold tracking-tight",
        )}
      />
      {errors.title ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.title.message}
        </p>
      ) : null}

      <textarea
        aria-label="Description"
        aria-invalid={errors.description ? true : undefined}
        placeholder="Add a description"
        rows={1}
        {...form.register("description", {
          onBlur: () => void save("description"),
        })}
        className={cn(
          fieldClassName,
          "field-sizing-content resize-none py-0.5 text-muted-foreground placeholder:text-muted-foreground/70 focus-visible:text-foreground",
        )}
      />
      {errors.description ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.description.message}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Participants see the title and description from the last published
        version.
      </p>
    </div>
  );
}
