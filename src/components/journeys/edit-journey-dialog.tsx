"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { updateJourneyAction } from "@/app/projects/[projectId]/journeys/actions";
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
  updateJourneySchema,
  type UpdateJourneyInput,
} from "@/lib/validation/journey";

/**
 * A Journey's title and description are the whole of its metadata. It is
 * addressed by its id, so editing either never moves its URL and the dialog
 * only ever has to refresh the page it is sitting on.
 */
export function EditJourneyDialog({
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
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UpdateJourneyInput>({
    resolver: zodResolver(updateJourneySchema),
    defaultValues: { title, description },
  });

  async function onSubmit(values: UpdateJourneyInput) {
    setServerError(null);
    const result = await updateJourneyAction(projectId, journeyId, values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setServerError(null);
        // Reopening always starts from what the Journey is called now.
        form.reset({ title, description });
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
              The title and description are what members see in the project. The
              journey&apos;s address stays the same.
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
