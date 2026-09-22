"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { editProjectAction } from "@/app/projects/actions";
import { useBlurSavedForm } from "@/components/blur-saved-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  editProjectSchema,
  type EditProjectInput,
} from "@/lib/validation/project";

/**
 * A Project's title and description, edited in place on the Settings tab
 * and saved when a field is left (see `useBlurSavedForm`). The Project is
 * addressed by its id, so a rename never moves the page.
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
  const values = useMemo<EditProjectInput>(
    () => ({ title, description }),
    [title, description],
  );
  const { form, save, handleEnterKeyDown } = useBlurSavedForm({
    schema: editProjectSchema,
    values,
    submit: (next) => editProjectAction(projectId, next),
    // The header above the tabs and the Delete confirmation read the title
    // off the page's own props.
    onSaved: () => router.refresh(),
  });
  const { errors } = form.formState;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-title">Title</Label>
        <Input
          id="project-title"
          aria-invalid={errors.title ? true : undefined}
          autoComplete="off"
          {...form.register("title", { onBlur: () => void save("title") })}
          onKeyDown={handleEnterKeyDown}
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
