"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { editProjectAction } from "@/app/projects/actions";
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
import { slugify } from "@/lib/slug";
import {
  editProjectSchema,
  type EditProjectInput,
} from "@/lib/validation/project";

/**
 * Editing carries the slug alongside the title, prefilled with the current
 * one: a new title on its own never moves the Project's URL, and the Author
 * has to either edit the slug or ask for it to be regenerated.
 */
export function EditProjectDialog({
  title,
  slug,
}: {
  title: string;
  slug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<EditProjectInput>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: { title, slug },
  });

  async function onSubmit(values: EditProjectInput) {
    setServerError(null);
    const result = await editProjectAction(slug, values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setOpen(false);
    if (result.slug !== slug) {
      // The slug moved, so this page's URL did too.
      router.replace(`/projects/${result.slug}`);
    }
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setServerError(null);
        // Reopening always starts from what the Project is called now.
        form.reset({ title, slug });
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>Edit</DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              The slug is this project&apos;s address. Changing it moves the
              project to a new URL.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-project-title">Title</Label>
            <Input
              id="rename-project-title"
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
            <Label htmlFor="rename-project-slug">Slug</Label>
            <Input
              id="rename-project-slug"
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
