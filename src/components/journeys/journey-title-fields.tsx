"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { updateJourneyAction } from "@/app/projects/[projectId]/journeys/actions";
import { useAutosavedForm } from "@/components/autosaved-form";
import { STATUS_TEXT } from "@/lib/autosave";
import { cn } from "@/lib/utils";
import {
  updateJourneySchema,
  type UpdateJourneyInput,
} from "@/lib/validation/journey";

/**
 * A Journey's title and description are the whole of its metadata, so they
 * are the page's heading rather than a form behind an Edit button: two
 * borderless fields that read as headings until focused, saved as they are
 * typed into (see `useAutosavedForm`), with the line beneath them saying
 * where the record stands.
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
  const values = useMemo<UpdateJourneyInput>(
    () => ({ title, description }),
    [title, description],
  );
  const { form, status, change, flush, handleEnterKeyDown } = useAutosavedForm({
    schema: updateJourneySchema,
    values,
    submit: (next) => updateJourneyAction(projectId, journeyId, next),
    // The refresh is what lets Publish notice participants have not seen
    // this yet, and what puts the new title on the Delete confirmation.
    onSaved: () => router.refresh(),
  });
  const { errors } = form.formState;

  const fieldClassName =
    "-mx-1.5 w-full min-w-0 rounded-md bg-transparent px-1.5 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:ring-2 aria-invalid:ring-destructive/40";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <input
        aria-label="Title"
        aria-invalid={errors.title ? true : undefined}
        autoComplete="off"
        {...form.register("title", {
          onChange: () => change("title"),
          onBlur: () => void flush("title"),
        })}
        onKeyDown={handleEnterKeyDown}
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
          onChange: () => change("description"),
          onBlur: () => void flush("description"),
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

      <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
        <span role="status">{STATUS_TEXT[status]}</span>
        <span>
          Participants see the title and description from the last published
          version.
        </span>
      </p>
    </div>
  );
}
