"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { addMemberAction, removeMemberAction } from "@/app/projects/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MemberSummary } from "@/db/members";
import { addMemberSchema, type AddMemberInput } from "@/lib/validation/member";

const DEFAULT_VALUES: AddMemberInput = { email: "" };

/**
 * A Project's Members: every Author who can see it and edit its Journeys.
 * Lists them, adds one by the email of an account that has signed up, and
 * removes one — the Project's last Member never can be.
 */
export function MemberList({
  projectId,
  currentUserId,
  members,
}: {
  projectId: string;
  currentUserId: string;
  members: MemberSummary[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function onSubmit(values: AddMemberInput) {
    setServerError(null);
    const result = await addMemberAction(projectId, values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    form.reset(DEFAULT_VALUES);
    router.refresh();
  }

  const isLastMember = members.length === 1;

  return (
    <section aria-label="Members" className="flex flex-col gap-4">
      {/* role="list" is explicit: the flex layout below strips the list
          marker, and some browsers drop the implicit role with it. */}
      <ul role="list" aria-label="Members" className="flex flex-col gap-3">
        {members.map((memberRow) => (
          <MemberRow
            key={memberRow.userId}
            projectId={projectId}
            member={memberRow}
            isSelf={memberRow.userId === currentUserId}
            isLastMember={isLastMember}
          />
        ))}
      </ul>

      {/* noValidate: the browser's own email check would otherwise swallow
          the first malformed submit and show its bubble instead of the
          schema's message. */}
      <form
        className="flex flex-col gap-2"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Label htmlFor="add-member-email">Email</Label>
        <div className="flex flex-wrap items-start gap-2">
          <Input
            id="add-member-email"
            type="email"
            autoComplete="off"
            className="max-w-xs"
            {...form.register("email", {
              // A server answer is about the address it was given; editing
              // the address retires it rather than leaving it beside a
              // newer field error.
              onChange: () => setServerError(null),
            })}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Add member
          </Button>
        </div>
        {form.formState.errors.email ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function MemberRow({
  projectId,
  member,
  isSelf,
  isLastMember,
}: {
  projectId: string;
  member: MemberSummary;
  isSelf: boolean;
  isLastMember: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmRemove() {
    setServerError(null);
    startTransition(async () => {
      const result = await removeMemberAction(projectId, member.userId);

      if (!result.ok) {
        setServerError(result.error);
        return;
      }

      setOpen(false);
      if (isSelf) {
        // Removing yourself takes away the page you are looking at.
        router.push("/projects");
      }
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-1 rounded-xl px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium">{member.name}</span>
            {isSelf ? <Badge>You</Badge> : null}
          </div>
          <span className="text-muted-foreground text-sm">{member.email}</span>
        </div>

        <AlertDialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) setServerError(null);
          }}
        >
          <AlertDialogTrigger
            disabled={isLastMember}
            render={<Button variant="outline" />}
          >
            Remove
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {isSelf
                  ? "You lose access to every journey in this project. Another member can add you again by email."
                  : "They lose access to every journey in this project. You can add them again by email."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {serverError ? (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            ) : null}

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={confirmRemove}
              >
                Remove member
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {isLastMember ? (
        <p className="text-muted-foreground text-sm">
          A project keeps its last member
        </p>
      ) : null}
    </li>
  );
}
