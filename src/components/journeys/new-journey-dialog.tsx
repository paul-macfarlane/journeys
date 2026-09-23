"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createJourneyAction } from "@/app/projects/[projectId]/journeys/actions";
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
import {
  createJourneySchema,
  type CreateJourneyInput,
} from "@/lib/validation/journey";

const DEFAULT_VALUES: CreateJourneyInput = { title: "", description: "" };

/**
 * Creating a Journey takes a title and a short description. The Journey is
 * addressed by the id it is given, so the Author can edit both later from
 * its own page without moving it.
 */
export function NewJourneyDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateJourneyInput>({
    resolver: zodResolver(createJourneySchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function onSubmit(values: CreateJourneyInput) {
    setServerError(null);
    const result = await createJourneyAction(projectId, values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setOpen(false);
    form.reset(DEFAULT_VALUES);
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
          form.reset(DEFAULT_VALUES);
        }
      }}
    >
      <DialogTrigger render={<Button />}>New journey</DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <DialogHeader>
            <DialogTitle>New journey</DialogTitle>
            <DialogDescription>
              A journey is the graph of steps and choices participants walk. Its
              title and description can be changed later.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-journey-title">Title</Label>
            <Input
              id="new-journey-title"
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
            <Label htmlFor="new-journey-description">Description</Label>
            <Textarea
              id="new-journey-description"
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
              Create journey
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
