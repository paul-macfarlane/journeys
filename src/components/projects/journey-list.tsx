"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { moveJourneyAction } from "@/app/projects/[projectId]/journeys/actions";
import { JourneyStatusBadge } from "@/components/journeys/journey-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JourneySummary } from "@/db/journeys";
import type { MoveDirection } from "@/lib/journey-order";

/**
 * A Project's Journeys in the Author's order, each a link into its editor
 * with "Move up" and "Move down" beside it. The order is the server's: a
 * move calls the action and refreshes the page rather than reordering
 * locally, so what is shown is always what was stored, and two Members
 * moving rows at once see each other's result on the next refresh.
 */
export function JourneyList({
  projectId,
  journeys,
}: {
  projectId: string;
  journeys: JourneySummary[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function move(journeyId: string, direction: MoveDirection) {
    setServerError(null);
    startTransition(async () => {
      const result = await moveJourneyAction(projectId, journeyId, direction);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (journeys.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No journeys yet</CardTitle>
          <CardDescription>
            Journeys you author in this project will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      {/* role="list" is explicit: the flex layout below strips the list
          marker, and some browsers drop the implicit role with it. */}
      <ul role="list" aria-label="Journeys" className="flex flex-col gap-3">
        {journeys.map((journey, index) => (
          <li key={journey.id} className="flex items-stretch gap-2">
            <Link
              href={`/projects/${projectId}/journeys/${journey.id}`}
              className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{journey.title}</span>
                <JourneyStatusBadge publishState={journey.publishState} />
              </div>
              {journey.description ? (
                <p className="text-muted-foreground text-sm">
                  {journey.description}
                </p>
              ) : null}
            </Link>

            {/* Disabled at the ends, so the buttons say where a row can go
                without a click that would do nothing. */}
            <div className="flex flex-col justify-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Move up"
                disabled={pending || index === 0}
                onClick={() => move(journey.id, "up")}
              >
                <ChevronUpIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Move down"
                disabled={pending || index === journeys.length - 1}
                onClick={() => move(journey.id, "down")}
              >
                <ChevronDownIcon />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
