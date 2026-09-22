"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { updateJourneyAction } from "@/app/projects/[projectId]/journeys/actions";
import { firstIssue } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import {
  journeyDescriptionSchema,
  journeyTitleSchema,
} from "@/lib/validation/journey";

type Field = "title" | "description";
type Values = Record<Field, string>;
type Errors = Record<Field, string | null>;

const schemas = {
  title: journeyTitleSchema,
  description: journeyDescriptionSchema,
} as const;

/**
 * A Journey's title and description are the whole of its metadata, so they
 * are the page's heading rather than a form behind an Edit button: two
 * borderless fields that read as headings until focused. Each one saves
 * itself on blur (the title on Enter too); a save that fails says so under
 * the field and keeps what was typed.
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
  const [values, setValues] = useState<Values>({ title, description });
  const [errors, setErrors] = useState<Errors>({
    title: null,
    description: null,
  });

  // What the server has: what was last saved here or last rendered by it.
  const savedRef = useRef<Values>({ title, description });
  // What is in the fields, readable from a save started before a render.
  const valuesRef = useRef<Values>(values);
  // Saves run one after another: a title save and a description save that
  // crossed would each carry the other's stale value and one would win.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  // A refresh carrying a value this component did not save is another
  // Member's edit: adopted into a field the Author has not touched, and left
  // for the Author's own blur to overwrite in one they are mid-edit in, as
  // last write wins.
  useEffect(() => {
    const incoming: Values = { title, description };
    for (const field of ["title", "description"] as const) {
      if (incoming[field] === savedRef.current[field]) continue;
      if (valuesRef.current[field] === savedRef.current[field]) {
        valuesRef.current = { ...valuesRef.current, [field]: incoming[field] };
        setValues((current) => ({ ...current, [field]: incoming[field] }));
      }
      savedRef.current = { ...savedRef.current, [field]: incoming[field] };
    }
  }, [title, description]);

  function change(field: Field, value: string) {
    valuesRef.current = { ...valuesRef.current, [field]: value };
    setValues((current) => ({ ...current, [field]: value }));
  }

  function save(field: Field) {
    const parsed = schemas[field].safeParse(valuesRef.current[field]);
    if (!parsed.success) {
      setErrors((current) => ({
        ...current,
        [field]: firstIssue(parsed.error.issues),
      }));
      return;
    }

    const next = parsed.data;
    // The schema trims, so what stays on screen is what was stored.
    change(field, next);
    if (next === savedRef.current[field]) {
      setErrors((current) => ({ ...current, [field]: null }));
      return;
    }

    queueRef.current = queueRef.current.then(async () => {
      const input: Values = { ...savedRef.current, [field]: next };
      const result = await updateJourneyAction(
        projectId,
        journeyId,
        input,
      ).catch(() => ({
        ok: false as const,
        error: "the server could not be reached",
      }));

      if (!result.ok) {
        setErrors((current) => ({
          ...current,
          [field]: `Couldn't save: ${result.error}`,
        }));
        return;
      }

      savedRef.current = input;
      setErrors((current) => ({ ...current, [field]: null }));
      // The refresh is what lets Publish notice participants have not seen
      // this yet, and what puts the new title on the Delete confirmation.
      router.refresh();
    });
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
        aria-invalid={errors.title !== null || undefined}
        autoComplete="off"
        value={values.title}
        onChange={(event) => change("title", event.target.value)}
        onBlur={() => save("title")}
        onKeyDown={handleTitleKeyDown}
        className={cn(
          fieldClassName,
          "py-0.5 text-2xl font-semibold tracking-tight",
        )}
      />
      {errors.title !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.title}
        </p>
      ) : null}

      <textarea
        aria-label="Description"
        aria-invalid={errors.description !== null || undefined}
        placeholder="Add a description"
        rows={1}
        value={values.description}
        onChange={(event) => change("description", event.target.value)}
        onBlur={() => save("description")}
        className={cn(
          fieldClassName,
          "field-sizing-content resize-none py-0.5 text-muted-foreground placeholder:text-muted-foreground/70 focus-visible:text-foreground",
        )}
      />
      {errors.description !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.description}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Participants see the title and description from the last published
        version.
      </p>
    </div>
  );
}
