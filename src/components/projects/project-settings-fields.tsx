"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";

import { editProjectAction } from "@/app/projects/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  editProjectSchema,
  type EditProjectInput,
} from "@/lib/validation/project";

type Field = keyof EditProjectInput;

/**
 * A Project's title and description, edited in place on the Settings tab:
 * the same react-hook-form and zod pairing as the dialogs, submitted from
 * each field's blur (the title's Enter too) instead of a Save button, so a
 * save that fails says so under the field that asked for it and keeps what
 * was typed. Mirrors `JourneyTitleFields` on the Journey page.
 *
 * The Project is addressed by its id, so a rename never moves the page.
 */
export function ProjectSettingsFields({
  projectId,
  title,
  description,
}: {
  projectId: string;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const form = useForm<EditProjectInput>({
    resolver: zodResolver(editProjectSchema),
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

  /** The whole record, as the edit action takes it, from one field's blur. */
  function save(field: Field) {
    return form.handleSubmit(async (values) => {
      const saved = form.formState.defaultValues;
      if (
        values.title === saved?.title &&
        values.description === saved?.description
      ) {
        return;
      }

      const result = await editProjectAction(projectId, values).catch(() => ({
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
      // The header above the tabs and the Delete confirmation read the
      // title off the page's own props.
      router.refresh();
    })();
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // Blurring is the save; Enter only decides when.
    event.currentTarget.blur();
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-title">Title</Label>
        <Input
          id="project-title"
          aria-invalid={errors.title ? true : undefined}
          autoComplete="off"
          {...form.register("title", { onBlur: () => void save("title") })}
          onKeyDown={handleTitleKeyDown}
        />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          aria-invalid={errors.description ? true : undefined}
          placeholder="What this project's journeys are about"
          rows={3}
          {...form.register("description", {
            onBlur: () => void save("description"),
          })}
        />
        {errors.description ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        Changes save when you leave a field. Every member sees them; the
        project&apos;s address stays the same.
      </p>
    </div>
  );
}
