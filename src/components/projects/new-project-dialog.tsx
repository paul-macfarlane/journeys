"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createProjectAction } from "@/app/projects/actions";
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
import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/validation/project";

/**
 * Creating a Project takes a title and nothing else. The Project is
 * addressed by the id it is given, so the Author can rename it later from
 * its own page without moving it.
 */
export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { title: "" },
  });

  async function onSubmit(values: CreateProjectInput) {
    setServerError(null);
    const result = await createProjectAction(values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setOpen(false);
    form.reset({ title: "" });
    // The list above is a Server Component; the action revalidated it.
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setServerError(null);
          form.reset({ title: "" });
        }
      }}
    >
      <DialogTrigger render={<Button />}>New project</DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              A project groups the journeys you author with its other members.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-project-title">Title</Label>
            <Input
              id="new-project-title"
              autoComplete="off"
              {...form.register("title")}
            />
            {form.formState.errors.title ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.title.message}
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
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
