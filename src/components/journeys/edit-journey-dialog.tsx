"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { updateJourneyAction } from "@/app/projects/[projectSlug]/journeys/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slug";
import {
  updateJourneySchema,
  type UpdateJourneyInput,
} from "@/lib/validation/journey";

/**
 * Editing carries the slug alongside the title and description, prefilled
 * with the current one: a new title on its own never moves the Journey's
 * URL, and the Author has to either edit the slug or press "Regenerate from
 * title".
 */
export function EditJourneyDialog({
  projectSlug,
  title,
  slug,
  description,
}: {
  projectSlug: string;
  title: string;
  slug: string;
  description: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UpdateJourneyInput>({
    resolver: zodResolver(updateJourneySchema),
    defaultValues: { title, slug, description },
  });

  async function onSubmit(values: UpdateJourneyInput) {
    setServerError(null);
    const result = await updateJourneyAction(projectSlug, slug, values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setOpen(false);
    if (result.slug !== slug) {
      // The slug moved, so this page's URL did too.
      router.replace(`/projects/${projectSlug}/journeys/${result.slug}`);
    }
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setServerError(null);
        // Reopening always starts from what the Journey is called now.
        form.reset({ title, slug, description });
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>Edit</DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <DialogHeader>
            <DialogTitle>Edit journey</DialogTitle>
            <DialogDescription>
              The slug is this journey&apos;s future public address. It can be
              changed freely until the journey is first published.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-journey-title">Title</Label>
            <Input
              id="edit-journey-title"
              autoComplete="off"
              {...form.register("title")}
            />
            {form.formState.errors.title ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-journey-slug">Slug</Label>
            <Input
              id="edit-journey-slug"
              autoComplete="off"
              {...form.register("slug")}
            />
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  form.setValue("slug", slugify(form.getValues("title")), {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
              >
                Regenerate from title
              </Button>
            </div>
            {form.formState.errors.slug ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.slug.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-journey-description">Description</Label>
            <Textarea
              id="edit-journey-description"
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
            {serverError ? (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
