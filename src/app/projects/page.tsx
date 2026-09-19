import type { Metadata } from "next";

import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your projects",
};

export default async function ProjectsPage() {
  const session = await requireSession();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Your projects
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {session.user.name}
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>No projects yet</CardTitle>
          <CardDescription>
            Projects you create or are added to as a member will appear here,
            each holding its own journeys.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
